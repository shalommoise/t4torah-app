const { query } = require('../config/env');

const selectDates = async (filters, pagination) => {
  const conditions = [];
  const params = [];

  if (filters.gregorianDate) {
    conditions.push('gregorian_date = ?');
    params.push(filters.gregorianDate);
  }
  if (filters.hebrewDate) {
    conditions.push('hebrew_date = ?');
    params.push(filters.hebrewDate);
  }
  if (filters.isYomTov !== null) {
    conditions.push('is_yom_tov = ?');
    params.push(filters.isYomTov);
  }
  if (filters.specialDate) {
    conditions.push('special_date LIKE ?');
    params.push(`%${filters.specialDate}%`);
  }

  let sql = 'SELECT * FROM dates_table';
  if (conditions.length) {
    sql += ` WHERE ${conditions.join(' AND ')}`;
  }
  sql += ' ORDER BY date_id ASC';
  if (pagination.limit !== null) {
    sql += ' LIMIT ? OFFSET ?';
    params.push(pagination.limit, pagination.offset);
  }

  const [rows] = await query(sql, params);
  return rows;
};

const selectDateById = async (dateId) => {
  const [rows] = await query('SELECT * FROM dates_table WHERE date_id = ?', [dateId]);
  return rows;
};

const selectTime4MishnaScheduleByDateId = async (dateId) => {
  const [rows] = await query(
    `SELECT
      ds.daily_schedule_id,
      ds.shiur_type,
      ds.additional_notice,
      s.time4mishna_shiur_id,
      s.shiur_title,
      s.start_mishna,
      s.end_mishna,
      start_masechta.masechta_id AS start_masechta_id,
      start_masechta.masechta_name AS start_masechta_name,
      start_mishna.perek AS start_perek,
      start_mishna.mishna AS start_mishna_number,
      end_masechta.masechta_id AS end_masechta_id,
      end_masechta.masechta_name AS end_masechta_name,
      end_mishna.perek AS end_perek,
      end_mishna.mishna AS end_mishna_number
    FROM time4mishna_daily_schedule ds
    LEFT JOIN time4mishna_shiurim s
      ON ds.time4mishna_shiur_id = s.time4mishna_shiur_id
    LEFT JOIN mishnayos_table start_mishna
      ON s.start_mishna = start_mishna.mishna_id
    LEFT JOIN masechta_table start_masechta
      ON start_mishna.masechta_id = start_masechta.masechta_id
    LEFT JOIN mishnayos_table end_mishna
      ON s.end_mishna = end_mishna.mishna_id
    LEFT JOIN masechta_table end_masechta
      ON end_mishna.masechta_id = end_masechta.masechta_id
    WHERE ds.date_id = ?
    ORDER BY ds.daily_schedule_id ASC`,
    [dateId]
  );
  return rows;
};

const selectTime4NachScheduleByDateId = async (dateId) => {
  const [rows] = await query(
    `SELECT
      ds.daily_schedule_id,
      ds.shiur_type,
      ds.additional_notice,
      s.time4nach_shiur_id,
      s.shiur_title,
      s.sefer_id,
      s.perek,
      t.sefer_name,
      t.sefer_name_he,
      t.section,
      t.subsection
    FROM time4nach_daily_schedule ds
    LEFT JOIN time4nach_shiurim s
      ON ds.time4nach_shiur_id = s.time4nach_shiur_id
    LEFT JOIN tanach_table t
      ON s.sefer_id = t.sefer_id
    WHERE ds.date_id = ?
    ORDER BY ds.daily_schedule_id ASC`,
    [dateId]
  );
  return rows;
};

module.exports = {
  selectDates,
  selectDateById,
  selectTime4MishnaScheduleByDateId,
  selectTime4NachScheduleByDateId,
};
