const { getSchedulerConfig, timeToCron } = require('../../config/scheduler');

const errorMessage = (error) => (error && error.message) || String(error);

/**
 * Starts the in-app scheduler: the evening and morning runs from ./tasks.js,
 * on node-cron in SEND_TIMEZONE (Europe/London by default), so clock changes
 * don't move them.
 *
 * Safeguards:
 * - off unless SCHEDULER_ENABLED=true; SEND_MODE still decides live vs dry-run;
 * - a config problem logs "not started" and returns `null` instead of
 *   throwing, so the API keeps serving;
 * - every run uses the write DB pool (runWithDatabaseRole), leaving the API on
 *   the read-only pool, and never closes a pool;
 * - one run at a time: a run that starts while another is going is skipped;
 * - every error is caught and logged; nothing reaches the process.
 *
 * Only one copy of the app should have SCHEDULER_ENABLED=true.
 *
 * @param {object} [options]
 * @param {Record<string, string|undefined>} [options.env]
 * @param {{ log: Function, error: Function }} [options.logger]
 * @param {{ schedule: Function }} [options.cron] node-cron, for tests
 * @param {Function} [options.buildTasks] ./tasks buildScheduledTasks, for tests
 * @param {Function} [options.runWithRole] config/env runWithDatabaseRole, for tests
 * @returns {{ stop: () => void, runNow: (name: 'evening'|'morning') => Promise<object|null> } | null}
 */
const startScheduler = ({
  env = process.env,
  logger = console,
  cron = require('node-cron'),
  buildTasks = require('./tasks').buildScheduledTasks,
  runWithRole = require('../../config/env').runWithDatabaseRole,
} = {}) => {
  let config;
  let tasks;
  try {
    config = getSchedulerConfig(env);
    if (!config.enabled) {
      logger.log('[scheduler] off (set SCHEDULER_ENABLED=true to run the daily sends from this app)');
      return null;
    }
    tasks = buildTasks(env, config, logger);
  } catch (error) {
    logger.error(`[scheduler] NOT STARTED: ${errorMessage(error)}`);
    return null;
  }

  let running = null;
  const run = async (name) => {
    if (running) {
      logger.error(`[scheduler] ${name} run skipped: the ${running} run is still going`);
      return null;
    }
    running = name;
    const started = Date.now();
    logger.log(`[scheduler] ${name} run started`);
    try {
      const result = await runWithRole('write', () => tasks[name]());
      const seconds = ((Date.now() - started) / 1000).toFixed(1);
      if (result.ok) {
        logger.log(`[scheduler] ${name} run finished ok (${seconds}s)`);
      } else {
        logger.error(
          `[scheduler] ${name} run finished with ${result.failures.length} failure(s) (${seconds}s): ${result.failures.join('; ')}`
        );
      }
      return result;
    } catch (error) {
      logger.error(`[scheduler] ${name} run FAILED: ${errorMessage(error)}`);
      return { ok: false, failures: [errorMessage(error)] };
    } finally {
      running = null;
    }
  };

  const options = { timezone: config.timeZone };
  const jobs = [
    cron.schedule(timeToCron(config.eveningTime), () => run('evening'), { ...options, name: 't4t-evening' }),
    cron.schedule(timeToCron(config.morningTime), () => run('morning'), { ...options, name: 't4t-morning' }),
  ];
  logger.log(
    `[scheduler] on: evening run ${config.eveningTime}, morning run ${config.morningTime} (${config.timeZone})` +
      `${config.castos ? `, Castos ${config.castosDays} day(s) ahead` : ', Castos off'}`
  );

  return {
    stop: () => jobs.forEach((job) => job.stop()),
    runNow: (name) => run(name),
  };
};

module.exports = { startScheduler };
