const { selectSendLogByDate } = require('../models/sendLogModel');
const { isValidGregorianDate } = require('./dailyContentService');

/**
 * @typedef {object} SendLogEntry
 * @property {number} id
 * @property {string} program
 * @property {'email'|'whatsapp'} channel
 * @property {'dry-run'|'live'} mode
 * @property {'sent'|'failed'} status
 * @property {string|null} providerMessageId
 * @property {Date|string} createdAt
 */

const toEntry = (row) => ({
  id: row.send_log_id,
  program: row.program,
  channel: row.channel,
  mode: row.mode,
  status: row.status,
  providerMessageId: row.provider_message_id,
  createdAt: row.created_at,
});

/**
 * Read-only view of send_log for one date, oldest attempt first. A date with
 * no attempts returns an empty list.
 *
 * @param {{ date: string }} options
 * @returns {Promise<{ date: string, entries: SendLogEntry[] }>}
 * @throws 400 for an invalid date.
 */
const getSendLog = async ({ date } = {}) => {
  if (!isValidGregorianDate(date)) {
    throw Object.assign(new Error('date must be a valid date in YYYY-MM-DD format'), { status: 400 });
  }
  const rows = await selectSendLogByDate(date);
  return { date, entries: rows.map(toEntry) };
};

module.exports = { getSendLog };
