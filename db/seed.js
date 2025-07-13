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
    const {query,values} = dates;
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
// const {createMishnaQuery} = require("./createMishnayosFile");
// const createMishnaShiurimQuery = require("./fillMishnaShiurim");
getDates().then(() => {
  const sedarimQuery = `INSERT INTO sedarim_table (seder_name,alt_names)
  VALUES ?`;
  const sedarimValues= [['Zeraim','זרעים'],['Moed','מועד'],[ 'Nashim','נשים'],['Nezikin','נזיקין'],['Kodshim','קדשים'],['Tahoros','טהרות']]
 connection.query(sedarimQuery, [sedarimValues], (err, results) => {
  if (err) {
    console.error('Insert error:', err);
         connection.end();
  } else {
    console.log('Successfully inserted rows into Sedarim Table:', results.affectedRows);
  }
});
// add maschtosTable
const {mesachtaTableQuery,  masechtaTableValues} = masechtaTable;
 connection.query(mesachtaTableQuery, [masechtaTableValues], (err, results) => {
  if (err) {
    console.error('Insert error:', err);
         connection.end();
  } else {
    console.log('Successfully inserted rows into Masechtos Table:', results.affectedRows);
  }
});
const {mishnayosQuery,mishnayosValues}= mishnayosTable
mishnayosValues.forEach((mishnayosValue, index)=>{
 connection.query(mishnayosQuery, mishnayosValue, (err, results) => {
  if (err) {
    console.error('Insert error:', err);
         connection.end();
  } else {
    console.log(`Successfully inserted row ${index} into Mishnayos Table`);
  }
});
console.log("Successfully inserted rows into Masechtos Table:")
})

     connection.end();
})
//   connection.query(mesachtaTableQuery, (error, results, fields) => {
//     if (error) throw error;
//     console.log('finished adding maschtos');
//   })
// mishnayos.forEach((mishnaIndex)=>{
//   const mishnaQuery = createMishnaQuery(mishnaIndex)
//   connection.query(mishnaQuery,(error, results, fields) => {
//     if (error) throw error;
//     console.log('Added Mishna');
//   })
// })
// console.log("added all mishnayos");
// connection.query(createMishnaShiurimQuery,(error, results, fields) => {
//     if (error) throw error;
//     console.log('finished adding shiurim');
//   })

//     connection.end();
 
// })

