const { query } = require('../config/env');

// summary_sheets: one row per summary/diagram PDF in the bucket, covering
// mishnayos start_mishna..end_mishna; see db/setup.sql.

/**
 * The first and last mishna_id of a masechta, a perek of it, or one mishna.
 * The masechta name is matched case-insensitively against masechta_name.
 *
 * @param {{ masechta: string, perek?: number|null, mishna?: number|null }} position
 * @returns {Promise<{ masechta_name: string, first_mishna_id: number, last_mishna_id: number }|null>}
 *   `null` when nothing matches.
 */
const selectMishnaRange = async ({ masechta, perek = null, mishna = null }) => {
  const conditions = ['LOWER(t.masechta_name) = LOWER(?)'];
  const params = [masechta];
  if (perek !== null) {
    conditions.push('m.perek = ?');
    params.push(perek);
  }
  if (mishna !== null) {
    conditions.push('m.mishna = ?');
    params.push(mishna);
  }
  const [rows] = await query(
    `SELECT t.masechta_name, MIN(m.mishna_id) AS first_mishna_id, MAX(m.mishna_id) AS last_mishna_id
    FROM mishnayos_table m
    JOIN masechta_table t ON t.masechta_id = m.masechta_id
    WHERE ${conditions.join(' AND ')}
    GROUP BY t.masechta_name`,
    params
  );
  return rows[0] || null;
};

/**
 * The first and last mishna_id of a seder, matched case-insensitively
 * against seder_name. For material that covers a whole seder.
 *
 * @param {string} seder
 * @returns {Promise<{ seder_name: string, first_mishna_id: number, last_mishna_id: number }|null>}
 *   `null` when nothing matches.
 */
const selectSederMishnaRange = async (seder) => {
  const [rows] = await query(
    `SELECT s.seder_name, MIN(m.mishna_id) AS first_mishna_id, MAX(m.mishna_id) AS last_mishna_id
    FROM mishnayos_table m
    JOIN masechta_table t ON t.masechta_id = m.masechta_id
    JOIN sedarim_table s ON s.seder_id = t.seder_id
    WHERE LOWER(s.seder_name) = LOWER(?)
    GROUP BY s.seder_name`,
    [seder]
  );
  return rows[0] || null;
};

/**
 * Inserts a sheet, or updates the row with the same bucket_key.
 *
 * @param {{ kind: string, startMishna: number, endMishna: number, part: number, bucketKey: string, sourceRef: string|null }} sheet
 * @returns {Promise<'inserted'|'updated'|'unchanged'>}
 */
const upsertSummarySheet = async ({ kind, startMishna, endMishna, part, bucketKey, sourceRef }) => {
  const [result] = await query(
    `INSERT INTO summary_sheets (kind, start_mishna, end_mishna, part, bucket_key, source_ref)
    VALUES (?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE kind = VALUES(kind), start_mishna = VALUES(start_mishna),
      end_mishna = VALUES(end_mishna), part = VALUES(part), source_ref = VALUES(source_ref)`,
    [kind, startMishna, endMishna, part, bucketKey, sourceRef]
  );
  // MySQL reports 1 for an insert, 2 for an update and 0 when nothing changed.
  if (result.affectedRows === 1) {
    return 'inserted';
  }
  return result.affectedRows === 2 ? 'updated' : 'unchanged';
};

/**
 * Every sheet that overlaps mishnayos startMishna..endMishna, in learning
 * order: by where the sheet starts, then part, then kind.
 *
 * @param {number} startMishna
 * @param {number} endMishna
 * @returns {Promise<object[]>}
 */
const selectSummarySheetsForRange = async (startMishna, endMishna) => {
  const [rows] = await query(
    `SELECT * FROM summary_sheets
    WHERE start_mishna <= ? AND end_mishna >= ?
    ORDER BY start_mishna, part, kind`,
    [endMishna, startMishna]
  );
  return rows;
};

/** @returns {Promise<string[]>} Every bucket_key in summary_sheets. */
const selectSummarySheetKeys = async () => {
  const [rows] = await query('SELECT bucket_key FROM summary_sheets ORDER BY bucket_key');
  return rows.map((row) => row.bucket_key);
};

module.exports = {
  selectMishnaRange,
  selectSederMishnaRange,
  upsertSummarySheet,
  selectSummarySheetsForRange,
  selectSummarySheetKeys,
};
