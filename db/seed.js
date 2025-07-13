require('dotenv').config();
var mysql = require('mysql2');
var connection = mysql.createConnection({
  host: process.env.DATABASE_HOST,
  user: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
  database: process.env.DATABASE_NAME,
  charset: 'utf8mb4'
});

connection.connect((err) => {
  if (err) {
    console.error('Error connecting:', err.stack);
    return;
  }
  console.log('Connected as id ' + connection.threadId);
});


// get dates query;
const createDates = require("./fillDatesIntoTable");
async function getDates() {
  try {
    const dates = await createDates();
    const { query, values } = dates;
    connection.query(query, [values], (err, results) => {
      if (err) {
        console.error('Insert error:', err);
      } else {
        console.log('Successfully inserted rows into Dates Table:', results.affectedRows);
      }

    });

  } catch (err) {
    console.error("Error:", err);
    connection.end();
  }
}

const masechtaTable = require("./fillMasechtaIntoTable");
const mishnayosTable = require("./fillIntoMishnayostable")
const mishnaShiurimTable = require("./fillMishnaShiurim");
// Add rows to dates table
getDates().then(() => {
  const sedarimQuery = `INSERT INTO sedarim_table (seder_name,alt_names)
  VALUES ?`;
  const sedarimValues = [['Zeraim', 'זרעים'], ['Moed', 'מועד'], ['Nashim', 'נשים'], ['Nezikin', 'נזיקין'], ['Kodshim', 'קדשים'], ['Tahoros', 'טהרות']]
  connection.query(sedarimQuery, [sedarimValues], (err, results) => {
    if (err) {
      console.error('Insert error:', err);
      connection.end();
    } else {
      console.log('Successfully inserted rows into Sedarim Table:', results.affectedRows);
    }
  });
  // add rows to maschtosTable
  const { mesachtaTableQuery, masechtaTableValues } = masechtaTable;
  connection.query(mesachtaTableQuery, [masechtaTableValues], (err, results) => {
    if (err) {
      console.error('Insert error:', err);
      connection.end();
    } else {
      console.log('Successfully inserted rows into Masechtos Table:', results.affectedRows);
    }
  });
  // Add rows to Mishnayos Table
  const { mishnayosQuery, mishnayosValues } = mishnayosTable
  mishnayosValues.forEach((mishnayosValue, index) => {
    connection.query(mishnayosQuery, mishnayosValue, (err, results) => {
      if (err) {
        console.error('Insert error:', err);
        connection.end();
      } else {
        console.log(`Successfully inserted row ${index} into Mishnayos Table`);
      }
    });
    console.log("Successfully inserted rows into Mishnayos Table")
  })
// Add rows to mishnayos shiurim table
  const { shiurimQuery, shiurimValues } = mishnaShiurimTable;
  connection.query(shiurimQuery, [shiurimValues], (err, results) => {
    if (err) {
      console.error('Insert error:', err);
      connection.end();
    } else {
      console.log('Successfully inserted rows into mishna shiurim Table:', results.affectedRows);
    }
  });
  console.log("Seeding complete!")
  connection.end();
})


