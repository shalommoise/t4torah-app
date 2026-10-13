const { getDailyContent } = require('./dailyContentService');
const { shouldSendOn } = require('./sendRules');
const { renderDailyMessage } = require('./dailySendService');
const { PROGRAMS } = require('./render/dailyMessage');
const { CHANNELS } = require('./senders');

const DEFAULT_PROGRAM = 'time4mishna';

const httpError = (status, message) => Object.assign(new Error(message), { status });

/**
 * Renders a day's message for previewing. Never sends and never touches
 * send_log.
 *
 * @param {object} options
 * @param {string} options.date `YYYY-MM-DD`
 * @param {string} [options.program] Defaults to `time4mishna`.
 * @param {string} [options.channel] `email` or `whatsapp`; both when omitted.
 * @returns {Promise<{ date: string, program: string, sendDay: boolean,
 *   email?: { subject: string, html: string, text: string }, whatsapp?: { text: string } }>}
 * @throws 400 for a bad date, program or channel; 404 when the date isn't in dates_table.
 */
const getSendPreview = async ({ date, program = DEFAULT_PROGRAM, channel } = {}) => {
  if (!PROGRAMS.includes(program)) {
    throw httpError(400, `program must be one of: ${PROGRAMS.join(', ')}`);
  }
  if (channel !== undefined && !CHANNELS.includes(channel)) {
    throw httpError(400, `channel must be one of: ${CHANNELS.join(', ')}`);
  }

  const content = await getDailyContent(date);
  if (!content) {
    throw httpError(404, `No date row for ${date}`);
  }

  const message = renderDailyMessage(content, program);
  const preview = { date: message.date, program, sendDay: shouldSendOn(content.date) };
  if (channel === undefined || channel === 'email') {
    preview.email = message.email;
  }
  if (channel === undefined || channel === 'whatsapp') {
    preview.whatsapp = message.whatsapp;
  }
  return preview;
};

module.exports = { getSendPreview };
