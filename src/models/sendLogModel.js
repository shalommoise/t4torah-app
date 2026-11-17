const { query } = require('../config/env');

// One send_log row per (send_date, program, channel, mode, audience); see
// db/setup.sql. `key` is always { date, program, channel, mode, audience }.
// `audience` is the Mailchimp audience ID for an email send, and '' when there
// is none (WhatsApp, or a dry-run without Mailchimp config), so a send to a
// test audience never blocks the same date's send to the real one.

const keyParams = ({ date, program, channel, mode, audience = '' }) => [date, program, channel, mode, audience];

const KEY_WHERE = 'send_date = ? AND program = ? AND channel = ? AND mode = ? AND audience = ?';

/**
 * Claims a key that has never been attempted by inserting a `claimed` row.
 *
 * @returns {Promise<boolean>} `false` if a row already exists (duplicate key).
 */
const claimSendLog = async (key) => {
  try {
    await query(
      `INSERT INTO send_log (send_date, program, channel, mode, audience, status, attempts)
      VALUES (?, ?, ?, ?, ?, 'claimed', 1)`,
      keyParams(key)
    );
    return true;
  } catch (error) {
    if (error && error.code === 'ER_DUP_ENTRY') {
      return false;
    }
    throw error;
  }
};

/**
 * Claims a key whose last attempt `failed`. Atomic: only one caller can flip
 * the row from `failed` to `claimed`.
 *
 * @returns {Promise<boolean>} `true` only if exactly one row was updated.
 */
const reclaimFailedSendLog = async (key) => {
  const [result] = await query(
    `UPDATE send_log
    SET status = 'claimed', attempts = attempts + 1, provider_message_id = NULL
    WHERE ${KEY_WHERE} AND status = 'failed'`,
    keyParams(key)
  );
  return result.affectedRows === 1;
};

/**
 * Claims a key whatever its current status (for `--force`): inserts a
 * `claimed` row, or resets an existing one to `claimed`.
 *
 * @returns {Promise<true>}
 */
const forceClaimSendLog = async (key) => {
  await query(
    `INSERT INTO send_log (send_date, program, channel, mode, audience, status, attempts)
    VALUES (?, ?, ?, ?, ?, 'claimed', 1)
    ON DUPLICATE KEY UPDATE status = 'claimed', attempts = attempts + 1, provider_message_id = NULL`,
    keyParams(key)
  );
  return true;
};

/**
 * Records the outcome of a claimed send.
 *
 * @param {{ date: string, program: string, channel: string, mode: string, audience?: string }} key
 * @param {{ status: 'sent'|'failed', providerMessageId?: string|null }} outcome
 * @returns {Promise<boolean>} `false` if the row was no longer `claimed`.
 */
const finishSendLog = async (key, { status, providerMessageId = null }) => {
  const [result] = await query(
    `UPDATE send_log
    SET status = ?, provider_message_id = ?
    WHERE ${KEY_WHERE} AND status = 'claimed'`,
    [status, providerMessageId, ...keyParams(key)]
  );
  return result.affectedRows === 1;
};

/**
 * The send_log row for a key, if any (0 or 1 rows).
 */
const selectSendLog = async (key) => {
  const [rows] = await query(`SELECT * FROM send_log WHERE ${KEY_WHERE}`, keyParams(key));
  return rows;
};

/**
 * All send_log rows for a date, oldest first.
 */
const selectSendLogByDate = async (date) => {
  const [rows] = await query(
    `SELECT * FROM send_log
    WHERE send_date = ?
    ORDER BY send_log_id ASC`,
    [date]
  );
  return rows;
};

// Time4Tefilla rows are keyed by shiur, not by date: `key` is
// { date, program, channel, mode, audience, shiurKey }, where `date` is the
// day it goes out and `shiurKey` (never '') identifies the shiur. The daily
// programs' functions above leave shiur_key at ''.

const SHIUR_WHERE = 'program = ? AND channel = ? AND mode = ? AND audience = ? AND shiur_key = ?';

const shiurParams = ({ program, channel, mode, audience = '', shiurKey }) => {
  if (typeof shiurKey !== 'string' || shiurKey.trim() === '') {
    throw new Error('A shiur send_log key needs a non-empty shiurKey');
  }
  return [program, channel, mode, audience, shiurKey];
};

/**
 * Claims a shiur that has never been attempted.
 *
 * @returns {Promise<boolean>} `false` if the shiur already has a row (on any date).
 */
const claimShiurSendLog = async (key) => {
  const params = shiurParams(key);
  try {
    await query(
      `INSERT INTO send_log (send_date, program, channel, mode, audience, shiur_key, status, attempts)
      VALUES (?, ?, ?, ?, ?, ?, 'claimed', 1)`,
      [key.date, ...params]
    );
    return true;
  } catch (error) {
    if (error && error.code === 'ER_DUP_ENTRY') {
      return false;
    }
    throw error;
  }
};

/**
 * Claims a shiur whose last attempt `failed`, moving it to `key.date`. Atomic:
 * only one caller can flip the row from `failed` to `claimed`.
 *
 * @returns {Promise<boolean>}
 */
const reclaimFailedShiurSendLog = async (key) => {
  const params = shiurParams(key);
  const [result] = await query(
    `UPDATE send_log
    SET status = 'claimed', attempts = attempts + 1, provider_message_id = NULL, send_date = ?
    WHERE ${SHIUR_WHERE} AND status = 'failed'`,
    [key.date, ...params]
  );
  return result.affectedRows === 1;
};

/**
 * Records the outcome of a claimed shiur send.
 *
 * @param {{ program: string, channel: string, mode: string, audience?: string, shiurKey: string }} key
 * @param {{ status: 'sent'|'failed', providerMessageId?: string|null }} outcome
 * @returns {Promise<boolean>} `false` if the row was no longer `claimed`.
 */
const finishShiurSendLog = async (key, { status, providerMessageId = null }) => {
  const params = shiurParams(key);
  const [result] = await query(
    `UPDATE send_log
    SET status = ?, provider_message_id = ?
    WHERE ${SHIUR_WHERE} AND status = 'claimed'`,
    [status, providerMessageId, ...params]
  );
  return result.affectedRows === 1;
};

/**
 * The send_log row for a shiur, if any (0 or 1 rows).
 */
const selectShiurSendLog = async (key) => {
  const [rows] = await query(`SELECT * FROM send_log WHERE ${SHIUR_WHERE}`, shiurParams(key));
  return rows;
};

module.exports = {
  claimShiurSendLog,
  reclaimFailedShiurSendLog,
  finishShiurSendLog,
  selectShiurSendLog,
  claimSendLog,
  reclaimFailedSendLog,
  forceClaimSendLog,
  finishSendLog,
  selectSendLog,
  selectSendLogByDate,
};
