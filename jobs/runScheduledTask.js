#!/usr/bin/env node
// Runs one scheduled run by hand, exactly as the in-app scheduler would:
// `npm run scheduler:run -- --run=evening|morning`
//
// Useful to check the setup on the host. SEND_MODE still decides live vs
// dry-run; SCHEDULER_ENABLED is not needed. Exit codes: 0 ok, 1 any failure,
// 2 usage/config error.

const USAGE = `Usage: npm run scheduler:run -- --run=evening|morning

  evening   email for tomorrow, Castos for the next SCHEDULER_CASTOS_DAYS days
  morning   email and Castos for today (catch-up)`;

const RUNS = ['evening', 'morning'];

const parseArgs = (argv) => {
  if (argv.length === 1 && argv[0] === '--help') {
    return { help: true };
  }
  const match = argv.length === 1 ? /^--run=(.+)$/.exec(argv[0]) : null;
  if (!match || !RUNS.includes(match[1])) {
    throw new Error(`Expected --run=evening or --run=morning (got "${argv.join(' ')}")`);
  }
  return { help: false, run: match[1] };
};

const main = async (argv, deps) => {
  const {
    env,
    log,
    error,
    getSchedulerConfig,
    buildScheduledTasks,
    closePool,
  } = deps || loadDefaultDeps();

  let args;
  let tasks;
  try {
    args = parseArgs(argv);
    if (args.help) {
      log(USAGE);
      return 0;
    }
    tasks = buildScheduledTasks(env, getSchedulerConfig(env), { log, error });
  } catch (err) {
    error(err.message);
    error(USAGE);
    return 2;
  }

  try {
    const result = await tasks[args.run]();
    if (result.ok) {
      log(`[scheduler] ${args.run} run finished ok`);
      return 0;
    }
    error(`[scheduler] ${args.run} run finished with failures: ${result.failures.join('; ')}`);
    return 1;
  } catch (err) {
    error(`[scheduler] ${args.run} run FAILED: ${err.message}`);
    return 1;
  } finally {
    try {
      await closePool();
    } catch (err) {
      error(`Closing the DB pool failed: ${err.message}`);
    }
  }
};

function loadDefaultDeps() {
  require('dotenv').config();
  return {
    env: process.env,
    log: (line) => console.log(line),
    error: (line) => console.error(line),
    getSchedulerConfig: require('../src/config/scheduler').getSchedulerConfig,
    buildScheduledTasks: require('../src/services/scheduler/tasks').buildScheduledTasks,
    closePool: () => require('../src/config/env').closePool(),
  };
}

if (require.main === module) {
  main(process.argv.slice(2)).then((code) => {
    process.exitCode = code;
  });
}

module.exports = { parseArgs, main, USAGE };
