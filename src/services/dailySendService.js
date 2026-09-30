const { getDailyContent } = require('./dailyContentService');
const { shouldSendOn } = require('./sendRules');
const { getSenders } = require('./senders');
const { getSendConfig } = require('../config/send');
const { createDailyMessage } = require('./render/dailyMessage');
const { renderEmail } = require('./render/emailRenderer');
const { renderWhatsapp } = require('./render/whatsappRenderer');
const { buildSubject } = require('./render/subjectLine');
const { insertSendLog, selectSendLog } = require('../models/sendLogModel');

/**
 * @typedef {object} SendReportEntry
 * @property {string} program
 * @property {'email'|'whatsapp'} channel
 * @property {string|null} sender Sender name, or `null` when rendering failed.
 * @property {boolean} ok
 * @property {string} [id]
 * @property {string} [error]
 * @property {boolean} [skipped] Already logged `sent` for this date; not sent again.
 * @property {string} [logError] Sent, but recording it in send_log failed.
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

const PROVIDER_ID_MAX_LENGTH = 255;

const errorMessage = (error) => (error && error.message) || String(error);

/**
 * Renders one program's DailyMessage from `getDailyContent` output.
 *
 * @param {{ date: object, time4mishna: object[], time4nach: object[] }} content
 * @param {'time4mishna'|'time4nach'|'combined'} program
 * @returns {import('./render/dailyMessage').DailyMessage}
 */
const renderDailyMessage = (content, program) =>
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

/**
 * Sends one program's message on one channel, unless send_log already has a
 * `sent` row for it (and `force` is off), then records the attempt.
 * A send_log read failure blocks the send, to avoid sending twice.
 */
const sendChannel = async ({ date, program, channel, mode, force, message, channelSenders }) => {
  const base = (sender) => ({ program, channel, sender: sender.name });

  if (!force) {
    let rows;
    try {
      rows = await selectSendLog(date, program, channel, mode);
    } catch (error) {
      return channelSenders.map((sender) => ({
        ...base(sender),
        ok: false,
        error: `Send log check failed: ${errorMessage(error)}`,
      }));
    }
    if (rows.some((row) => row.status === 'sent')) {
      return channelSenders.map((sender) => ({ ...base(sender), ok: true, skipped: true }));
    }
  }

  const entries = await Promise.all(channelSenders.map((sender) => sendWith(sender, message)));
  const ids = entries.filter((entry) => entry.ok && entry.id !== undefined).map((entry) => String(entry.id));
  try {
    await insertSendLog({
      date,
      program,
      channel,
      mode,
      status: entries.every((entry) => entry.ok) ? 'sent' : 'failed',
      providerMessageId: ids.length ? ids.join(', ').slice(0, PROVIDER_ID_MAX_LENGTH) : null,
    });
  } catch (error) {
    const logError = `Send log write failed: ${errorMessage(error)}`;
    return entries.map((entry) => ({ ...entry, logError }));
  }
  return entries;
};

const isOk = (result) => result.ok && !result.logError;

const getStatus = (results) => {
  const okCount = results.filter(isOk).length;
  if (results.length && okCount === results.length) {
    return 'sent';
  }
  return okCount ? 'partial' : 'failed';
};

/**
 * Runs the daily send for one date: content → send-day rules → render → send
 * via every sender for each program. Each program/channel is sent at most once
 * per date and mode (tracked in send_log) unless `force` is set.
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
 * @param {boolean} [options.force=false] Send even if send_log already has a `sent` row.
 * @returns {Promise<SendReport>}
 */
const runDailySend = async ({
  date,
  dryRun = true,
  channels,
  programs = getSendConfig({}).programs,
  outboxDir,
  logger,
  force = false,
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

  const activeChannels = [...new Set(senders.map((sender) => sender.channel))];
  const results = [];
  for (const program of programs) {
    let message;
    try {
      message = renderDailyMessage(content, program);
    } catch (error) {
      senders.forEach((sender) =>
        results.push({ program, channel: sender.channel, sender: null, ok: false, error: `Render failed: ${errorMessage(error)}` })
      );
      continue;
    }

    // Keyed by sender so the report keeps getSenders() order.
    const entries = new Map();
    for (const channel of activeChannels) {
      const channelSenders = senders.filter((sender) => sender.channel === channel);
      const channelEntries = await sendChannel({ date, program, channel, mode, force, message, channelSenders });
      channelSenders.forEach((sender, index) => entries.set(sender, channelEntries[index]));
    }
    results.push(...senders.map((sender) => entries.get(sender)));
  }

  const status = getStatus(results);
  return { ...report, status, ok: status === 'sent', results };
};

module.exports = { runDailySend, renderDailyMessage };
