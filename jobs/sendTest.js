#!/usr/bin/env node
// Test send: `npm run send:test -- --to=you@example.org [--date=YYYY-MM-DD]`
//
// Renders the Time4Mishna email for a date exactly as the daily send would and
// sends it with Mailchimp's "send test" action to the given addresses only. It
// never sends to the audience and never touches send_log; the draft campaign
// is deleted afterwards. Needs the MAILCHIMP_* config.
//
// Exit codes: 0 sent, 1 failure or missing date, 2 usage/config error.

const { londonToday } = require('../src/utils/londonDate');

const USAGE = `Usage: npm run send:test -- --to=EMAIL[,EMAIL...] [--date=YYYY-MM-DD]

  --to=EMAIL[,EMAIL...]   Who gets the test (required)
  --date=YYYY-MM-DD       Date to render (default: today in Europe/London)
  --help                  Show this help`;

const EXIT_OK = 0;
const EXIT_FAILURE = 1;
const EXIT_USAGE = 2;

const PROGRAM = 'time4mishna';

class UsageError extends Error {}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Parses CLI arguments. Pure: no environment, clock or I/O.
 *
 * @param {string[]} argv Arguments after the script name.
 * @param {{ today: string }} defaults
 * @returns {{ help: boolean, date: string, to: string[] }}
 * @throws {UsageError}
 */
const parseArgs = (argv, { today }) => {
  const args = { help: false, date: today, to: [] };
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
    } else if (name === 'to') {
      const emails = [...new Set((value || '').split(',').map((e) => e.trim()).filter(Boolean))];
      const invalid = emails.filter((email) => !EMAIL_PATTERN.test(email));
      if (!emails.length || invalid.length) {
        throw new UsageError(`--to must be one or more email addresses (got "${value || ''}")`);
      }
      args.to = emails;
    } else {
      throw new UsageError(`Unknown option: --${name}`);
    }
  }
  if (!args.help && !args.to.length) {
    throw new UsageError('--to is required');
  }
  return args;
};

const loadDefaultDeps = () => {
  require('dotenv').config();
  const { getMailchimpConfig } = require('../src/config/mailchimp');
  const { getEmailConfig } = require('../src/config/email');
  const { getDailyContent } = require('../src/services/dailyContentService');
  const { getEmailExtras } = require('../src/services/emailExtrasService');
  const { getChazara } = require('../src/services/chazaraService');
  const { renderDailyMessage } = require('../src/services/dailySendService');
  const { createMailchimpClient } = require('../src/services/mailchimp/client');
  const { sendTestEmail } = require('../src/services/mailchimp/testSend');
  return {
    env: process.env,
    now: new Date(),
    getMailchimpConfig,
    getEmailConfig,
    getDailyContent,
    getEmailExtras,
    getChazara,
    renderDailyMessage,
    createMailchimpClient,
    sendTestEmail,
    // Required lazily so --help and usage errors never create the pool.
    closePool: () => require('../src/config/env').closePool(),
    log: (line) => console.log(line),
    error: (line) => console.error(line),
  };
};

/**
 * Runs the test send and returns its exit code. Dependencies are injectable for tests.
 *
 * @param {string[]} argv
 * @param {object} [deps]
 * @returns {Promise<number>}
 */
const main = async (argv, deps = loadDefaultDeps()) => {
  const { env, now, log, error, closePool } = deps;

  let args;
  let mailchimp;
  let emailConfig;
  try {
    args = parseArgs(argv, { today: londonToday(now) });
    if (args.help) {
      log(USAGE);
      return EXIT_OK;
    }
    mailchimp = deps.getMailchimpConfig(env);
    emailConfig = deps.getEmailConfig(env);
  } catch (err) {
    error(err.message);
    if (err instanceof UsageError) {
      error(USAGE);
    }
    return EXIT_USAGE;
  }

  let exitCode = EXIT_FAILURE;
  try {
    const content = await deps.getDailyContent(args.date);
    if (!content) {
      error(`${args.date} is not in dates_table`);
      return EXIT_FAILURE;
    }
    const extras = await deps.getEmailExtras(content, emailConfig);
    const chazara = await deps.getChazara(content, emailConfig);
    const message = deps.renderDailyMessage(content, PROGRAM, emailConfig, extras, chazara);
    const result = await deps.sendTestEmail({
      message,
      emails: args.to,
      mailchimp,
      client: deps.createMailchimpClient(mailchimp),
    });
    if (result.ok) {
      log(`[test] ${args.date} "${message.email.subject}" sent to ${args.to.join(', ')}`);
      exitCode = EXIT_OK;
    } else {
      error(`[test] ${args.date} FAILED: ${result.error}`);
    }
    if (result.cleanupError) {
      error(`[test] ${result.cleanupError}`);
    }
  } catch (err) {
    error(`Test send failed: ${err.message}`);
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
