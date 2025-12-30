const { getConnection, pool } = require("./mysql")
// startConnection();

// get dates query;
const createDates = require("./fillDatesIntoTable");
async function getDates() {
  try {
    const dates = await createDates();
    const { query, values } = dates;
    const connection = await getConnection();
    return connection.query(query, [values], (err, results) => {
      if (err) {
        console.error('Insert error:', err);
      } else {
        console.log('Successfully inserted rows into Dates Table:', results.affectedRows);
      }

    });

  } catch (err) {
    console.error("Error:", err);
    // connection.end();
  }
}

const masechtaTable = require("./fillMasechtaIntoTable");
const mishnayosTable = require("./fillIntoMishnayostable")

// Add rows to dates table
getDates().then(async () => {
  console.log("Completed adding to Dates table")
  const connection = await getConnection();
  const sedarimQuery = `INSERT INTO sedarim_table (seder_name,alt_names)
  VALUES ?`;
  const sedarimValues = [['Zeraim', 'זרעים'], ['Moed', 'מועד'], ['Nashim', 'נשים'], ['Nezikin', 'נזיקין'], ['Kodshim', 'קדשים'], ['Tahoros', 'טהרות']]
  return connection.query(sedarimQuery, [sedarimValues], (err, results) => {
    if (err) {
      console.error('Insert error:', err);
      connection.end();
    } else {
      console.log('Successfully inserted rows into Sedarim Table:', results.affectedRows);
    }
  }).then(() => {
    // add rows to maschtosTable
    console.log("Completed adding to Sedarim table.");
    const { mesachtaTableQuery, masechtaTableValues } = masechtaTable;
    return connection.query(mesachtaTableQuery, [masechtaTableValues], (err, results) => {
      if (err) {
        console.error('Insert error:', err);
        connection.end();
      } else {
        console.log('Successfully inserted rows into Masechtos Table:', results.affectedRows);
      }
    });
    // Add rows to Mishnayos Table
  }).then(() => {
    console.log("Completed adding to Masechtos table.");
    const { mishnayosQuery, mishnayosValues } = mishnayosTable;

    const addMishnayosToTable = async (arr, query) => {
      const connection = await getConnection();

      try {
        for (const values of arr) {
          await connection.query(query, values);
          // console.log("added", values);
        }
      } catch (err) {
        console.error("Error inserting:", err);
      } finally {
        connection.release?.(); // if it's a pool connection
        // or await connection.end(); if it's a single connection
        await pool.end();
        console.log("Successfully inserted rows into Mishnayos Table.");
        console.log("Initial seed complete - now run 'npm run fillMishnaShiurim'");
       
      }
    };
    addMishnayosToTable(mishnayosValues, mishnayosQuery);

    connection.release()

  })

})


