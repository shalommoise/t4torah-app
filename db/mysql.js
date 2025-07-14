require('dotenv').config();
var mysql = require('mysql2');
var connection = mysql.createConnection({
  host: process.env.DATABASE_HOST,
  user: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
  database: process.env.DATABASE_NAME,
  charset: 'utf8mb4'
});

const startConnection = ()=>{
connection.connect((err) => {
  if (err) {
    console.error('Error connecting:', err.stack);
    return;
  }
  console.log('Connected as id ' + connection.threadId);
});
}


module.exports ={ connection, startConnection}