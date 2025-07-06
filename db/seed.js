require('dotenv').config();
var mysql = require('mysql');
var connection = mysql.createConnection({
  host: process.env.DATABASE_HOST,
  user: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
  database: process.env.DATABASE_NAME
});

connection.connect();


// get dates query;
const createDates = require("./fillDatesIntoTable");
const addAllMasechtos = require("./fillMishnayosIntoTable")
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
async function fetchMishnayos() {
  try {
    const mishnayos = await addAllMasechtos();
    connection.query(mishnayos, function (error, results, fields) {
      if (error) throw error;
      console.log('finished adding mishnayos!');
    });
  } catch (err) {
    console.error("Error:", err);
  }
}
const mesachtaTableQuery = require("./fillMasechtaIntoTable");
getDates().then(() => {
  connection.query(`INSERT INTO sedarim_table (seder_name,alt_names)VALUES
  ('Zeraim','זרעים'),
  ('Moed','מועד'),
  ('Nashim','נשים'),
  ('Nezikin','נזיקין'),
  ('Kodshim','קדשים'),
  ('Tahoros','טהרות')
  ;`, function (error, results, fields) {
    if (error) throw error;
    console.log('finished adding sedarim');
  })
  connection.query(mesachtaTableQuery, (error, results, fields) => {
    if (error) throw error;
    console.log('finished adding maschtos');
  })
  fetchMishnayos().then(() => {
    connection.end();
  })
})

