require('dotenv').config();
var mysql = require('mysql');
var connection = mysql.createConnection({
  host: process.env.DATABASE_HOST,
  user: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
  database: process.env.DATABASE_NAME
});

connection.connect();
// assumes database is already made 



// get dates query;
const createDates = require("./create_dates");
async function getDates() {
  try {
    const dates = await createDates();
    connection.query(dates, function (error, results, fields) {
      if (error) throw error;
      console.log('finished adding dates!');
    });


  } catch (err) {
    console.error("Error:", err);
  }
}

getDates();