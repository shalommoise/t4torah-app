const {getConnection, pool } = require(`../config/env`);

const selectMasechtos = async () => {
    const connection = await getConnection();
    try {
        const [rows] = await connection.execute('SELECT * FROM masechta_table');
        return rows;
    } finally {
        connection.release();
    }
};

const selectMaschechtaById = async (masechtaId) => {
    const connection = await getConnection();
    try {
        const [rows] = await connection.execute('SELECT * FROM masechta_table WHERE masechta_id = ?', [masechtaId]);
        return rows;
    } finally {
        connection.release();
    }
};       

module.exports = { selectMasechtos, selectMaschechtaById };