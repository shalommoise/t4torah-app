const { query } = require('../config/env');

const selectTime4NachShiurim = async (filters) => {
  const conditions = [];
  const params = [];

  if (filters.seferId !== null) {
    conditions.push('sefer_id = ?');
    params.push(filters.seferId);
  }
  if (filters.perek !== null) {
    conditions.push('perek = ?');
    params.push(filters.perek);
  }
  if (filters.shiurTitle) {
    conditions.push('shiur_title LIKE ?');
    params.push(`%${filters.shiurTitle}%`);
  }

  let sql = 'SELECT * FROM time4nach_shiurim';
  if (conditions.length) {
    sql += ` WHERE ${conditions.join(' AND ')}`;
  }
  sql += ' ORDER BY time4nach_shiur_id ASC';

  const [rows] = await query(sql, params);
  return rows;
};

const selectTime4NachShiurById = async (shiurId) => {
  const [rows] = await query(
    'SELECT * FROM time4nach_shiurim WHERE time4nach_shiur_id = ?',
    [shiurId]
  );
  return rows;
};

const selectTime4NachSchedule = async (filters, pagination) => {
  const conditions = [];
  const params = [];

  if (filters.dateId !== null) {
    conditions.push('date_id = ?');
    params.push(filters.dateId);
  }

  let sql = 'SELECT * FROM time4nach_daily_schedule';
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

const selectTime4NachScheduleById = async (dailyScheduleId) => {
  const [rows] = await query(
    'SELECT * FROM time4nach_daily_schedule WHERE daily_schedule_id = ?',
    [dailyScheduleId]
  );
  return rows;
};

module.exports = {
  selectTime4NachShiurim,
  selectTime4NachShiurById,
  selectTime4NachSchedule,
  selectTime4NachScheduleById,
};
