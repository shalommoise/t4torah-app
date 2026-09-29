#!/usr/bin/env node
// Daily send job: `npm run send:daily -- [--date=YYYY-MM-DD] [--dry-run=false] [--channel=email|whatsapp] [--force]`
//
// Going live needs both SEND_MODE=live and --dry-run=false; either alone is
// dry-run (or a usage error, for --dry-run=false without SEND_MODE=live).
//
// Exit codes: 0 all ok (or skipped Shabbos/Yom Tov), 1 any send failure or
// missing date, 2 usage/config error.

const { CHANNELS } = require('../src/services/senders');

const USAGE = `Usage: npm run send:daily -- [options]

  --date=YYYY-MM-DD           Date to send (default: today in Europe/London)
  --dry-run[=true|false]      Default true. --dry-run=false also needs SEND_MODE=live
  --channel=email|whatsapp    Only this channel (comma-separate for several; default: SEND_CHANNELS)
  --force                     Send even if send_log already has a 'sent' row
  --help                      Show this help`;

const EXIT_OK = 0;
const EXIT_FAILURE = 1;
const EXIT_USAGE = 2;

class UsageError extends Error {}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Today's date in Europe/London as YYYY-MM-DD.
 * TODO(D4): replace with the shared London date helper.
 */
const londonToday = (now = new Date()) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/London',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);

const parseBoolean = (name, value) => {
  if (value === undefined || value === 'true') {
    return true;
  }
  if (value === 'false') {
    return false;
  }
  throw new UsageError(`${name} must be true or false (got "${value}")`);
};

/**
 * Parses CLI arguments. Pure: no environment, clock or I/O.
 *
 * @param {string[]} argv Arguments after the script name.
 * @param {{ today: string }} defaults `today` is the default --date.
 * @returns {{ help: boolean, date: string, dryRun: boolean, channels?: string[], force: boolean }}
 * @throws {UsageError}
 */
const parseArgs = (argv, { today }) => {
  const args = { help: false, date: today, dryRun: true, force: false };
  const seen = new Set();

  for (const arg of argv) {
    const match = /^--([a-z-]+)(?:=(.*))?$/.exec(arg);
    if (!match) {
      throw new UsageError(`Unexpected argument: ${arg}`);
    }
    const [, name, value] = match;
    if (seen.has(name)) {
      throw new UsageError(`--${name} given more than once`);
    }
    seen.add(name);

    switch (name) {
      case 'help':
        args.help = true;
        break;
      case 'date':
        if (!value || !DATE_PATTERN.test(value)) {
          throw new UsageError(`--date must be YYYY-MM-DD (got "${value || ''}")`);
        }
        args.date = value;
        break;
      case 'dry-run':
        args.dryRun = parseBoolean('--dry-run', value);
        break;
      case 'force':
        args.force = parseBoolean('--force', value);
        break;
      case 'channel': {
        const channels = [...new Set((value || '').split(',').map((c) => c.trim()).filter(Boolean))];
        const unknown = channels.filter((channel) => !CHANNELS.includes(channel));
        if (!channels.length || unknown.length) {
          throw new UsageError(`--channel must be one or more of: ${CHANNELS.join(', ')} (got "${value || ''}")`);
        }
        args.channels = channels;
        break;
      }
      default:
        throw new UsageError(`Unknown option: --${name}`);
    }
  }
  return args;
};

/**
 * Human-readable report lines.
 *
 * @param {import('../src/services/dailySendService').SendReport} report
 * @returns {string[]}
 */
const formatReport = (report) => {
  const lines = [`[${report.mode}] ${report.date}: ${report.status}${report.reason ? ` (${report.reason})` : ''}`];
  report.results.forEach((result) => {
    let outcome;
    if (result.skipped) {
      outcome = 'skipped (already sent)';
    } else if (result.ok) {
      outcome = `ok${result.id !== undefined ? ` ${result.id}` : ''}`;
    } else {
      outcome = `FAILED: ${result.error}`;
    }
    if (result.logError) {
      outcome += ` [${result.logError}]`;
    }
    lines.push(`  ${result.program} ${result.channel} ${result.sender || '-'}: ${outcome}`);
  });
  return lines;
};

const loadDefaultDeps = () => {
  require('dotenv').config();
  const { getSendConfig } = require('../src/config/send');
  const { runDailySend } = require('../src/services/dailySendService');
  return {
    env: process.env,
    now: new Date(),
    getSendConfig,
    runDailySend,
    // Required lazily so --help and usage errors never create the pool.
    closePool: () => require('../src/config/env').pool.end(),
    log: (line) => console.log(line),
    error: (line) => console.error(line),
  };
};

/**
 * Runs the job and returns its exit code. Dependencies are injectable for tests.
 *
 * @param {string[]} argv
 * @param {object} [deps]
 * @returns {Promise<number>}
 */
const main = async (argv, deps = loadDefaultDeps()) => {
  const { env, now, getSendConfig, runDailySend, closePool, log, error } = deps;

  let args;
  let config;
  try {
    args = parseArgs(argv, { today: londonToday(now) });
    if (args.help) {
      log(USAGE);
      return EXIT_OK;
    }
    config = getSendConfig(env);
    if (!args.dryRun && config.mode !== 'live') {
      throw new UsageError('--dry-run=false needs SEND_MODE=live');
    }
  } catch (err) {
    error(err.message);
    if (err instanceof UsageError) {
      error(USAGE);
    }
    return EXIT_USAGE;
  }

  let exitCode = EXIT_FAILURE;
  try {
    const report = await runDailySend({
      date: args.date,
      dryRun: args.dryRun,
      channels: args.channels || config.channels,
      programs: config.programs,
      outboxDir: config.outboxDir,
      force: args.force,
      logger: { log },
    });
    formatReport(report).forEach((line) => (report.ok ? log(line) : error(line)));
    exitCode = report.ok ? EXIT_OK : EXIT_FAILURE;
  } catch (err) {
    error(`Daily send failed: ${err.message}`);
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

module.exports = { parseArgs, formatReport, londonToday, main, UsageError, USAGE };
