#!/usr/bin/env node
// Send preview: `npm run sends:preview -- [--date=YYYY-MM-DD] [--program=P] [--channel=C] [--html=FILE]`
//
// Renders a day's message exactly as the daily send would and prints it as
// JSON, or writes the email HTML to a file with --html. Never sends anything
// and never touches send_log. Replaces GET /api/v1/sends/preview(.html).
//
// Exit codes: 0 ok, 1 failure or date not in dates_table, 2 usage error.

const { londonToday } = require('../src/utils/londonDate');

const USAGE = `Usage: npm run sends:preview -- [--date=YYYY-MM-DD] [--program=PROGRAM] [--channel=CHANNEL] [--html=FILE]

  --date=YYYY-MM-DD   Date to render (default: today in Europe/London)
  --program=PROGRAM   time4mishna (default), time4nach or combined
  --channel=CHANNEL   email or whatsapp (default: both)
  --html=FILE         Write the email HTML to FILE instead of printing JSON
  --help              Show this help`;

const EXIT_OK = 0;
const EXIT_FAILURE = 1;
const EXIT_USAGE = 2;

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

class UsageError extends Error {}

/**
 * Parses CLI arguments. Pure: no environment, clock or I/O. Program and
 * channel values are checked by the preview service.
 *
 * @param {string[]} argv
 * @param {{ today: string }} defaults
 * @returns {{ help: boolean, date: string, program?: string, channel?: string, html?: string }}
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
    } else if (['program', 'channel', 'html'].includes(name)) {
      if (!value) {
        throw new UsageError(`--${name} needs a value`);
      }
      args[name] = value;
    } else {
      throw new UsageError(`Unknown option: --${name}`);
    }
  }
  if (args.html && args.channel && args.channel !== 'email') {
    throw new UsageError('--html writes the email, so it cannot be used with --channel=whatsapp');
  }
  return args;
};

const loadDefaultDeps = () => {
  require('dotenv').config();
  return {
    now: new Date(),
    getSendPreview: require('../src/services/sendPreviewService').getSendPreview,
    writeFile: require('fs/promises').writeFile,
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
    const preview = await deps.getSendPreview({
      date: args.date,
      program: args.program,
      channel: args.html ? 'email' : args.channel,
    });
    if (args.html) {
      await deps.writeFile(args.html, preview.email.html);
      log(`${preview.date} ${preview.program} email "${preview.email.subject}" written to ${args.html}`);
    } else {
      log(JSON.stringify(preview, null, 2));
    }
    exitCode = EXIT_OK;
  } catch (err) {
    error(`Preview failed: ${err.message}`);
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
