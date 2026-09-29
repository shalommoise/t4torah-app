const { getDailyContent } = require('./dailyContentService');
const { shouldSendOn } = require('./sendRules');
const { getSenders } = require('./senders');
const { getSendConfig } = require('../config/send');
const { createDailyMessage } = require('./render/dailyMessage');
const { renderEmail } = require('./render/emailRenderer');
const { renderWhatsapp } = require('./render/whatsappRenderer');
const { buildSubject } = require('./render/subjectLine');

/**
 * @typedef {object} SendReportEntry
 * @property {string} program
 * @property {'email'|'whatsapp'} channel
 * @property {string|null} sender Sender name, or `null` when rendering failed.
 * @property {boolean} ok
 * @property {string} [id]
 * @property {string} [error]
 */

/**
 * @typedef {object} SendReport
 * @property {string} date
 * @property {'dry-run'|'live'} mode
 * @property {'sent'|'partial'|'failed'|'skipped'|'no-date'} status
 * @property {boolean} ok `false` if anything failed or the date is missing.
 * @property {string} [reason] Why nothing was sent (`skipped` / `no-date`).
 * @property {SendReportEntry[]} results One entry per program × sender.
 */

const errorMessage = (error) => (error && error.message) || String(error);

const renderMessage = (content, program) =>
  createDailyMessage({
    date: content.date.gregorian_date,
    program,
    email: { subject: buildSubject(content.date, program), ...renderEmail(content, { program }) },
    whatsapp: renderWhatsapp(content, { program }),
  });

/**
 * Sends via one sender, turning both an `ok: false` result and a rejection
 * into a failed entry, so one sender can't stop the others.
 */
const sendWith = async (sender, message) => {
  const base = { program: message.program, channel: sender.channel, sender: sender.name };
  try {
    const result = await sender.send(message);
    if (result && result.ok) {
      return { ...base, ok: true, ...(result.id !== undefined && { id: result.id }) };
    }
    return { ...base, ok: false, error: (result && result.error) || 'Sender reported failure' };
  } catch (error) {
    return { ...base, ok: false, error: errorMessage(error) };
  }
};

const getStatus = (results) => {
  const okCount = results.filter((result) => result.ok).length;
  if (results.length && okCount === results.length) {
    return 'sent';
  }
  return okCount ? 'partial' : 'failed';
};

/**
 * Runs the daily send for one date: content → send-day rules → render → send
 * via every sender for each program.
 *
 * Live senders are used only when `dryRun` is explicitly `false`.
 *
 * @param {object} options
 * @param {string} options.date `YYYY-MM-DD`; an invalid date throws (status 400).
 * @param {boolean} [options.dryRun=true]
 * @param {('email'|'whatsapp')[]} [options.channels] Defaults to all channels.
 * @param {('time4mishna'|'time4nach'|'combined')[]} [options.programs] Defaults to the send config default.
 * @param {string} [options.outboxDir] For the dry-run file sender.
 * @param {{ log: (line: string) => void }} [options.logger] For the dry-run console sender.
 * @returns {Promise<SendReport>}
 */
const runDailySend = async ({
  date,
  dryRun = true,
  channels,
  programs = getSendConfig({}).programs,
  outboxDir,
  logger,
} = {}) => {
  const mode = dryRun === false ? 'live' : 'dry-run';
  const report = { date, mode };

  const content = await getDailyContent(date);
  if (!content) {
    return { ...report, status: 'no-date', ok: false, reason: `${date} is not in dates_table`, results: [] };
  }
  if (!shouldSendOn(content.date)) {
    return { ...report, status: 'skipped', ok: true, reason: 'No send on Shabbos or Yom Tov', results: [] };
  }

  const senders = getSenders({ mode, channels, outboxDir, logger });

  const results = [];
  for (const program of programs) {
    let message;
    try {
      message = renderMessage(content, program);
    } catch (error) {
      senders.forEach((sender) =>
        results.push({ program, channel: sender.channel, sender: null, ok: false, error: `Render failed: ${errorMessage(error)}` })
      );
      continue;
    }
    results.push(...(await Promise.all(senders.map((sender) => sendWith(sender, message)))));
  }

  const status = getStatus(results);
  return { ...report, status, ok: status === 'sent', results };
};

module.exports = { runDailySend };
