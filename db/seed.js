const { getConnection, pool } = require("./mysql")

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
  }
}

const masechtaTable = require("./fillMasechtaIntoTable");
const mishnayosTable = require("./fillIntoMishnayostable");
const tanachTable = require("./fillTanachTable");
const time4nachTable = require("./fillNachShiurim");

const insertSedarim = async () => {
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
  })
}

const insertTanachTable = async () => {
  const connection = await getConnection();
  const { tanachTableQuery, tanachTableValues } = tanachTable;
  return connection.query(tanachTableQuery, [tanachTableValues], (err, results) => {
    if (err) {
      console.error('Insert error:', err);
      connection.end();
    } else {
      console.log('Successfully inserted rows into Tanach Table:', results.affectedRows);
    }
  })
};

const time4NachTable = async () => {
  const connection = await getConnection();
  const { nachEntries, nachTableQuery } = time4nachTable;
  return connection.query(nachTableQuery, [nachEntries], (err, results) => {
    if (err) {
      console.error('Insert error:', err);
      connection.end();
    } else {
      console.log('Successfully inserted rows into Tanach Table:', results.affectedRows);
    }
  })
}

const insertMasechtaTable = async () => {
  const connection = await getConnection();
  const { mesachtaTableQuery, masechtaTableValues } = masechtaTable;
  return connection.query(mesachtaTableQuery, [masechtaTableValues], (err, results) => {
    if (err) {
      console.error('Insert error:', err);
      connection.end();
    } else {
      console.log('Successfully inserted rows into Masechtos Table:', results.affectedRows);
    }
  });
};

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
    // await pool.end();
  }
};

const { insertToShiurim, mishnayosArr } = require("./fillMishnaShiurim");
const { runMishnaSchedule } = require("./createSchedule/mishnaSchedule");
const { runNachSchedule } = require("./createSchedule/nachSchedule");
const {getForAllSchedule} = require("./createSchedule/chazaraSchedule")
const runSeed = async () => {
  await getDates();
  console.log("Completed adding to Dates table");
  await insertSedarim();
  console.log("Added Sedarim Table");
  await insertTanachTable();
  await time4NachTable();
  console.log("Added Time4Nach Table");
  await insertMasechtaTable();
  console.log("Added Masechta Table");
  const { mishnayosQuery, mishnayosValues } = mishnayosTable;
  await addMishnayosToTable(mishnayosValues, mishnayosQuery);
  console.log("added Mishnayos table");
  await insertToShiurim(mishnayosArr, 0);
  console.log("Added time4mishna shiurim table");
  await runMishnaSchedule();
  console.log("created Time4Mishna Schedule");
  await runNachSchedule();
  console.log("created time4Nach Schedule");
  await getForAllSchedule();
  console.log("created time4mishna friday chazara schedule");
  console.log("Seed complete ✅")
  // connection.release();
}


 runSeed();