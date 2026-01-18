const { getConnection, query } = require(`../config/env`);

const selectMishnas = async (filters, pagination) => {
    const conditions = [];
    const params = [];

    if (filters.masechtaId !== null) {
        conditions.push('masechta_id = ?');
        params.push(filters.masechtaId);
    }
    if (filters.perek !== null) {
        conditions.push('perek = ?');
        params.push(filters.perek);
    }
    if (filters.mishna !== null) {
        conditions.push('mishna = ?');
        params.push(filters.mishna);
    }

    let sql = 'SELECT * FROM mishnayos_table';
    if (conditions.length) {
        sql += ` WHERE ${conditions.join(' AND ')}`;
    }
    sql += ' ORDER BY mishna_id ASC';
    if (pagination.limit !== null) {
        sql += ' LIMIT ? OFFSET ?';
        params.push(pagination.limit, pagination.offset);
    }

    const [rows] = await query(sql, params);
    return rows;
};

const selectMishnaById = async (mishnaId) => {
    const connection = await getConnection();
    try {
        const [rows] = await connection.execute('SELECT * FROM mishnayos_table WHERE mishna_id = ?', [mishnaId]);
        return rows;
    } finally {
        connection.release();
    }
};

module.exports = { selectMishnas, selectMishnaById };
