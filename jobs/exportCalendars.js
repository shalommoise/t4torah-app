#!/usr/bin/env node
// Monthly calendar images: `npm run calendars:export -- [--from=YYYY-MM] [--all]`.
// Writes calendar/generated/T4M-MM-YY.png (plus calendar_MM_YYYY.pdf) for every
// month in the Time4Mishna schedule, ready to upload to <bucket>/mishna/calendars/.
//
// Exit codes: 0 ok, 1 a month failed, 2 usage error.

const { londonToday } = require('../src/utils/londonDate');

const USAGE = `Usage: npm run calendars:export -- [--from=YYYY-MM] [--all]

  --from=YYYY-MM   First month to export (default: the current month)
  --all            Every month in the schedule, including past ones
  --help           Show this help`;

const EXIT_OK = 0;
const EXIT_FAILURE = 1;
const EXIT_USAGE = 2;

class UsageError extends Error {}

/**
 * @param {string[]} argv
 * @param {{ today: string }} context today as YYYY-MM-DD
 * @returns {{ help: boolean, fromDate: string|null }}
 */
const parseArgs = (argv, { today }) => {
  const args = { help: false, fromDate: `${today.slice(0, 7)}-01` };
  let from = null;
  let all = false;

  for (const arg of argv) {
    const match = /^--([a-z]+)(?:=(.*))?$/.exec(arg);
    const name = match && match[1];
    if (name === 'help') {
      args.help = true;
    } else if (name === 'all' && match[2] === undefined) {
      all = true;
    } else if (name === 'from') {
      if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(match[2] || '')) {
        throw new UsageError('--from must be YYYY-MM');
      }
      from = match[2];
    } else {
      throw new UsageError(`Unexpected argument: ${arg}`);
    }
  }

  if (all && from) {
    throw new UsageError('--all and --from cannot be used together');
  }
  if (all) {
    args.fromDate = null;
  } else if (from) {
    args.fromDate = `${from}-01`;
  }
  return args;
};

const loadDefaultDeps = () => ({
  now: new Date(),
  exportScheduledCalendars: require('../src/services/calendarBatchService').exportScheduledCalendars,
  // Required lazily so --help and usage errors never create the pool.
  closePool: () => require('../src/config/env').closePool(),
  log: (line) => console.log(line),
  error: (line) => console.error(line),
});

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
    const { exported, failed } = await deps.exportScheduledCalendars({ fromDate: args.fromDate, log });
    log(`${exported.length} calendar(s) exported, ${failed.length} failed`);
    exitCode = failed.length ? EXIT_FAILURE : EXIT_OK;
  } catch (err) {
    error(`Calendar export failed: ${err.message}`);
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
