#!/usr/bin/env node
// Send log: `npm run sends:log -- [--date=YYYY-MM-DD]`
//
// Prints what send_log holds for a date as JSON: one entry per
// program/channel/mode. Read-only. Replaces GET /api/v1/sends/log.
//
// Exit codes: 0 ok, 1 failure, 2 usage error.

const { londonToday } = require('../src/utils/londonDate');

const USAGE = `Usage: npm run sends:log -- [--date=YYYY-MM-DD]

  --date=YYYY-MM-DD   Date to show (default: today in Europe/London)
  --help              Show this help`;

const EXIT_OK = 0;
const EXIT_FAILURE = 1;
const EXIT_USAGE = 2;

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

class UsageError extends Error {}

/**
 * @param {string[]} argv
 * @param {{ today: string }} defaults
 * @returns {{ help: boolean, date: string }}
 * @throws {UsageError}
 */
const parseArgs = (argv, { today }) => {
  const args = { help: false, date: today };
  for (const arg of argv) {
    const match = /^--([a-z]+)(?:=(.*))?$/.exec(arg);
    if (!match) {
      throw new UsageError(`Unexpected argument: ${arg}`);
    }
    const [, name, value] = match;
    if (name === 'help') {
      args.help = true;
    } else if (name === 'date') {
      if (!value || !DATE_PATTERN.test(value)) {
        throw new UsageError(`--date must be YYYY-MM-DD (got "${value || ''}")`);
      }
      args.date = value;
    } else {
      throw new UsageError(`Unknown option: --${name}`);
    }
  }
  return args;
};

const loadDefaultDeps = () => {
  require('dotenv').config();
  return {
    now: new Date(),
    getSendLog: require('../src/services/sendLogService').getSendLog,
    // Required lazily so --help and usage errors never create the pool.
    closePool: () => require('../src/config/env').closePool(),
    log: (line) => console.log(line),
    error: (line) => console.error(line),
  };
};

/**
 * @param {string[]} argv
 * @param {object} [deps]
 * @returns {Promise<number>} exit code
 */
const main = async (argv, deps = loadDefaultDeps()) => {
  const { log, error, closePool } = deps;

  let args;
  try {
    args = parseArgs(argv, { today: londonToday(deps.now) });
  } catch (err) {
    error(err.message);
    error(USAGE);
    return EXIT_USAGE;
  }
  if (args.help) {
    log(USAGE);
    return EXIT_OK;
  }

  let exitCode = EXIT_FAILURE;
  try {
    log(JSON.stringify(await deps.getSendLog({ date: args.date }), null, 2));
    exitCode = EXIT_OK;
  } catch (err) {
    error(`Reading send_log failed: ${err.message}`);
    exitCode = err.status === 400 ? EXIT_USAGE : EXIT_FAILURE;
  } finally {
    try {
      await closePool();
    } catch (err) {
      error(`Closing the DB pool failed: ${err.message}`);
    }
  }
  return exitCode;
};

if (require.main === module) {
  main(process.argv.slice(2)).then((code) => {
    process.exitCode = code;
  });
}

module.exports = { parseArgs, main, UsageError, USAGE };
