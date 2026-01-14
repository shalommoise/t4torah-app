const {getConnection, pool } = require(`../config/env`);

const selectMishnaById = async (mishnaId) => {
    console.log("mishnaId in model:", mishnaId);
    const connection = await getConnection();
    try {
        const [rows] = await connection.execute('SELECT * FROM mishnayos_table WHERE mishna_id = ?', [mishnaId]);
        return rows;
    } finally {
        connection.release();
    }
};

module.exports = { selectMishnaById };