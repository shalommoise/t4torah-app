const { query } = require('../config/env');

/**
 * Records one send attempt for a date/program/channel/mode.
 *
 * @param {{ date: string, program: string, channel: string, mode: string,
 *   status: 'sent'|'failed', providerMessageId?: string|null }} entry
 */
const insertSendLog = async ({ date, program, channel, mode, status, providerMessageId = null }) => {
  const [result] = await query(
    `INSERT INTO send_log (send_date, program, channel, mode, status, provider_message_id)
    VALUES (?, ?, ?, ?, ?, ?)`,
    [date, program, channel, mode, status, providerMessageId]
  );
  return result;
};

/**
 * Send attempts for a date/program/channel/mode, oldest first.
 */
const selectSendLog = async (date, program, channel, mode) => {
  const [rows] = await query(
    `SELECT * FROM send_log
    WHERE send_date = ? AND program = ? AND channel = ? AND mode = ?
    ORDER BY send_log_id ASC`,
    [date, program, channel, mode]
  );
  return rows;
};

module.exports = { insertSendLog, selectSendLog };
