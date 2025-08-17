require('dotenv').config();
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
    host: process.env.DATABASE_HOST,
    user: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
    database: process.env.DATABASE_NAME,
    charset: 'utf8mb4',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});
// const startConnection = async ()=>{
//    const connection = await pool.getConnection;
// connection.connect((err) => {
//   if (err) {
//     console.error('Error connecting:', err.stack);
//     return;
//   }
//   console.log('Connected as id ' + connection.threadId);
// });
// }
// const endConnecetion = async ()=>{
//   const connection = await getConnection();
// connection.end();
// }

// module.exports ={ getConnection, startConnection,endConnecetion}
const getConnection = () => pool.getConnection(); // gets a single connection (needs release)
const query = (sql, params) => pool.query(sql, params); // runs query & auto-releases

module.exports = { getConnection, query,pool };