const {getConnection, pool } = require(`../config/env`);

const showSedarim = async () => {
   
    const connection = await getConnection();
    try {
        const [rows] = await connection.execute('SELECT * FROM sedarim_table');
        return rows;
    } finally {
        connection.release();
    }
};

module.exports = { showSedarim };