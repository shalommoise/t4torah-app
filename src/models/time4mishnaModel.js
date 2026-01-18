const { query } = require('../config/env');

const selectTime4MishnaShiurim = async (filters) => {
  const conditions = [];
  const params = [];

  if (filters.startMishna !== null) {
    conditions.push('start_mishna = ?');
    params.push(filters.startMishna);
  }
  if (filters.endMishna !== null) {
    conditions.push('end_mishna = ?');
    params.push(filters.endMishna);
  }
  if (filters.shiurTitle) {
    conditions.push('shiur_title LIKE ?');
    params.push(`%${filters.shiurTitle}%`);
  }

  let sql = 'SELECT * FROM time4mishna_shiurim';
  if (conditions.length) {
    sql += ` WHERE ${conditions.join(' AND ')}`;
  }
  sql += ' ORDER BY time4mishna_shiur_id ASC';

  const [rows] = await query(sql, params);
  return rows;
};

const selectTime4MishnaShiurById = async (shiurId) => {
  const [rows] = await query(
    'SELECT * FROM time4mishna_shiurim WHERE time4mishna_shiur_id = ?',
    [shiurId]
  );
  return rows;
};

const selectTime4MishnaSchedule = async (filters, pagination) => {
  const conditions = [];
  const params = [];

  if (filters.dateId !== null) {
    conditions.push('date_id = ?');
    params.push(filters.dateId);
  }

  let sql = 'SELECT * FROM time4mishna_daily_schedule';
  if (conditions.length) {
    sql += ` WHERE ${conditions.join(' AND ')}`;
  }
  sql += ' ORDER BY daily_schedule_id ASC';
  if (pagination.limit !== null) {
    sql += ' LIMIT ? OFFSET ?';
    params.push(pagination.limit, pagination.offset);
  }

  const [rows] = await query(sql, params);
  return rows;
};

const selectTime4MishnaScheduleById = async (dailyScheduleId) => {
  const [rows] = await query(
    'SELECT * FROM time4mishna_daily_schedule WHERE daily_schedule_id = ?',
    [dailyScheduleId]
  );
  return rows;
};

module.exports = {
  selectTime4MishnaShiurim,
  selectTime4MishnaShiurById,
  selectTime4MishnaSchedule,
  selectTime4MishnaScheduleById,
};
