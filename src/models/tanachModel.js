const { query } = require('../config/env');

const selectSefarim = async (filters) => {
  const conditions = [];
  const params = [];

  if (filters.section) {
    conditions.push('section = ?');
    params.push(filters.section);
  }
  if (filters.subsection) {
    conditions.push('subsection = ?');
    params.push(filters.subsection);
  }
  if (filters.seferName) {
    conditions.push('(sefer_name LIKE ? OR sefer_alt_name LIKE ?)');
    const like = `%${filters.seferName}%`;
    params.push(like, like);
  }

  let sql = 'SELECT * FROM tanach_table';
  if (conditions.length) {
    sql += ` WHERE ${conditions.join(' AND ')}`;
  }
  sql += ' ORDER BY sefer_id ASC';

  const [rows] = await query(sql, params);
  return rows;
};

const selectSeferById = async (seferId) => {
  const [rows] = await query('SELECT * FROM tanach_table WHERE sefer_id = ?', [seferId]);
  return rows;
};

module.exports = { selectSefarim, selectSeferById };
