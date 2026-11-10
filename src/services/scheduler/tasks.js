const { londonToday, addDays } = require('../../utils/londonDate');

const errorMessage = (error) => (error && error.message) || String(error);

/**
 * The two scheduled runs, built from already-validated config. Each step
 * catches its own errors, so one failure never stops the rest of the run or
 * escapes into the server. Neither run closes the DB pool: the API server
 * shares it.
 *
 * - evening: email for tomorrow; Castos for tomorrow and the following
 *   `castosDays - 1` days (already-created episodes are skipped).
 * - morning: email and Castos for today, as a catch-up for anything the
 *   evening run missed. Both skip what's already done (send_log / existing
 *   episode title), so a good evening run makes this a no-op.
 *
 * @param {object} deps
 * @param {boolean} deps.live
 * @param {{ channels: string[], programs: string[], outboxDir: string }} deps.sendConfig
 * @param {object} [deps.mailchimp] getMailchimpConfig() output
 * @param {object} deps.emailConfig getEmailConfig() output
 * @param {{ castos: boolean, castosDays: number }} deps.schedulerConfig
 * @param {object|null} deps.castos getCastosConfig() output (null when Castos is off)
 * @param {string|null} deps.podcastId
 * @param {Function} deps.runDailySend
 * @param {Function} deps.formatSendReport jobs/dailySend formatReport
 * @param {Function} deps.getDailyContent
 * @param {Function} deps.publishDailyEpisode
 * @param {Function} deps.createCastosClient
 * @param {Function} deps.formatCastosResult jobs/publishCastosEpisode formatResult
 * @param {{ log: Function, error: Function }} deps.logger
 * @param {() => Date} [deps.now]
 * @returns {{ evening: () => Promise<RunResult>, morning: () => Promise<RunResult> }}
 *
 * @typedef {{ ok: boolean, failures: string[] }} RunResult
 */
const createScheduledTasks = (deps) => {
  const { live, sendConfig, mailchimp, emailConfig, schedulerConfig, castos, podcastId, logger } = deps;
  const now = deps.now || (() => new Date());
  const mode = live ? 'live' : 'dry-run';

  const sendEmail = async (date) => {
    const report = await deps.runDailySend({
      date,
      dryRun: !live,
      channels: sendConfig.channels,
      programs: sendConfig.programs,
      outboxDir: sendConfig.outboxDir,
      emailConfig,
      logger: { log: logger.log },
      ...(mailchimp && { mailchimp }),
    });
    deps.formatSendReport(report).forEach((line) => (report.ok ? logger.log(line) : logger.error(line)));
    if (!report.ok) {
      throw new Error(`status ${report.status}${report.reason ? ` (${report.reason})` : ''}`);
    }
  };

  const publishEpisode = async (date) => {
    const content = await deps.getDailyContent(date);
    if (!content) {
      throw new Error(`${date} is not in dates_table`);
    }
    const result = await deps.publishDailyEpisode({
      content,
      podcastId,
      client: deps.createCastosClient({ apiKey: castos.apiKey }),
      now: now(),
      timeZone: castos.timeZone,
      publishTime: castos.publishTime,
      bucketUrl: emailConfig.bucketUrl,
      dryRun: !live,
    });
    logger.log(
      deps.formatCastosResult(result, { date, podcast: live ? 'live' : 'test', dryRun: !live, timeZone: castos.timeZone })
    );
  };

  /** Runs the steps in order; a failed step is logged and recorded, never thrown. */
  const runSteps = async (steps) => {
    const failures = [];
    for (const [label, fn] of steps) {
      try {
        await fn();
      } catch (error) {
        const failure = `${label}: ${errorMessage(error)}`;
        logger.error(`[scheduler] [${mode}] ${failure}`);
        failures.push(failure);
      }
    }
    return { ok: failures.length === 0, failures };
  };

  const castosSteps = (dates) =>
    schedulerConfig.castos ? dates.map((date) => [`castos ${date}`, () => publishEpisode(date)]) : [];

  const evening = () => {
    const tomorrow = addDays(londonToday(now()), 1);
    const castosDates = Array.from({ length: schedulerConfig.castosDays }, (_, i) => addDays(tomorrow, i));
    return runSteps([[`email ${tomorrow}`, () => sendEmail(tomorrow)], ...castosSteps(castosDates)]);
  };

  const morning = () => {
    const today = londonToday(now());
    return runSteps([[`email ${today}`, () => sendEmail(today)], ...castosSteps([today])]);
  };

  return { evening, morning };
};

/**
 * Validates the environment and builds the scheduled tasks with the real
 * services. Throws on any config problem, so the scheduler doesn't start
 * half-configured.
 *
 * @param {Record<string, string|undefined>} env
 * @param {ReturnType<import('../../config/scheduler').getSchedulerConfig>} schedulerConfig
 * @param {{ log: Function, error: Function }} logger
 */
const buildScheduledTasks = (env, schedulerConfig, logger) => {
  const { getSendConfig } = require('../../config/send');
  const { getEmailConfig } = require('../../config/email');
  const { getMailchimpConfig, hasMailchimpConfig } = require('../../config/mailchimp');
  const { getCastosConfig } = require('../../config/castos');

  const sendConfig = getSendConfig(env);
  const live = sendConfig.mode === 'live';
  const emailConfig = getEmailConfig(env);
  if (!emailConfig.bucketUrl) {
    throw new Error('BUCKET_PATH is required');
  }
  const usesEmail = sendConfig.channels.includes('email');
  const mailchimp = usesEmail && (live || hasMailchimpConfig(env)) ? getMailchimpConfig(env) : undefined;

  let castos = null;
  let podcastId = null;
  if (schedulerConfig.castos) {
    castos = getCastosConfig(env);
    if (live && !castos.livePodcastId) {
      throw new Error('SEND_MODE=live with SCHEDULER_CASTOS=true needs CASTOS_LIVE_PODCAST_ID');
    }
    podcastId = live ? castos.livePodcastId : castos.testPodcastId;
  }

  return createScheduledTasks({
    live,
    sendConfig,
    mailchimp,
    emailConfig,
    schedulerConfig,
    castos,
    podcastId,
    logger,
    runDailySend: require('../dailySendService').runDailySend,
    formatSendReport: require('../../../jobs/dailySend').formatReport,
    getDailyContent: require('../dailyContentService').getDailyContent,
    publishDailyEpisode: require('../castos/publishEpisodeService').publishDailyEpisode,
    createCastosClient: require('../castos/client').createCastosClient,
    formatCastosResult: require('../../../jobs/publishCastosEpisode').formatResult,
  });
};

module.exports = { createScheduledTasks, buildScheduledTasks };
