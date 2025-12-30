const { getConnection,pool} = require("./mysql.js");
require('dotenv').config();

const scheduleStart = process.env.SCHEDULE_START ? process.env.SCHEDULE_START : "2025-05-01";
const mishnaIdStart = process.env.MISHNA_START_ID ? process.env.MISHNA_START_ID : 1;

const getDateId = async (date) => {
    let connection;
    try {
        connection = await getConnection();
        const [rows] = await connection.query(
            `SELECT date_id
             FROM dates_table 
             WHERE gregorian_date= ?`,
            [date]
        );

        if (rows.length === 0) {
            console.warn(`No id found for ${date}`);
            return null;
        }

        return rows[0].date_id;

    } catch (err) {
        console.error("Error getting date_id:", err.message);
        throw err; // rethrow so the caller knows it failed
    } finally {
        if (connection) {
            connection.release();
        }
    }
}

const getShiur = async (shiur_id) => {
    let connection;
    try {
        connection = await getConnection();
        const [rows] = await connection.query(
            `SELECT *
             FROM time4mishna_shiurim 
             WHERE time4mishna_shiur_id= ?`,
            [shiur_id]
        );

        if (rows.length === 0) {
            console.warn(`No shiur found for shiur id  = ${shiur_id}`);
            return null;
        }
        return rows[0];
    } catch (err) {
        console.error("Error getting shiur:", err.message);
        throw err; // rethrow so the caller knows it failed
    } finally {
        if (connection) {
            connection.release();
        }
    }
}

const getDateDetails = async (date_id) => {

    let connection;
    try {
        connection = await getConnection();
        const [rows] = await connection.query(
            `SELECT *
             FROM dates_table 
             WHERE date_id = ?`,
            [date_id]
        );

        if (rows.length === 0) {
            console.warn(`No Date found for ${date_id}`);
            return null;
        }

        return rows[0];

    } catch (err) {
        console.error("Error getting date detailss:", err.message);
        throw err; // rethrow so the caller knows it failed
    } finally {
        if (connection) {
            connection.release();
        }
    }
};

const calculateSchedule = (shiur) => {
    const scheduleObj = {};
scheduleObj.date_id = shiur.date_id;
    scheduleObj.additonal_notice =  shiur.dateObj.special_date;
    // figure out what shiur it should be based on the date
    if (shiur.dateObj.is_yom_tov) {
        // skip 
        scheduleObj.shiur_type = null;
        scheduleObj.shiur_id = null;
    } else if (shiur.dateObj.day_of_week === "Friday" || shiur.dateObj.day_of_week === "Shabbos") {
        // Chazara
        scheduleObj.shiur_type = "chazara";
        scheduleObj.shiur_id = null;

    } else {
        // regular schedule 
        scheduleObj.shiur_type = "regular";
        scheduleObj.shiur_id = shiur.time4mishna_shiur_id;
    }
    return scheduleObj;
}

const insertIntoSchedule = async (scheduleObj) => {
    const {shiur_type, shiur_id, date_id,additonal_notice} = scheduleObj;
    // console.log(shiur_id)
    let connection;
    try {
        connection = await getConnection();
        await connection.query(
            `INSERT INTO time4mishna_daily_schedule (shiur_type, time4mishna_shiur_id, date_id, additonal_notice)
             VALUES (?, ?, ?,?)`,
            [shiur_type, shiur_id, date_id, additonal_notice]
        );
    } catch (err) {
        console.log(err)
    } finally {
        if (connection) {
            connection.release();
        } 
    }
}


async function buildFullSchedule(startDateId, startShiurId) {
  try {
    let dateId = Number(startDateId);
    let shiurId = Number(startShiurId);

    while (true) {

      // stop if either ran out
      if (!dateId || !shiurId) break;

      const [dateObj, shiur] = await Promise.all([
        getDateDetails(dateId),
        getShiur(shiurId)
      ]);

      // stop when DB has no more
      if (!dateObj || !shiur) break;

      shiur.date_id = dateId;
      shiur.dateObj = dateObj;

      const scheduleObj = calculateSchedule(shiur);
      console.log(scheduleObj)
      await insertIntoSchedule(scheduleObj);

      // 👉 advance to the next pair
      dateId = dateId + 1;
      shiurId = scheduleObj.shiur_id ? shiurId + 1: shiurId;

    //   console.log("Next:", dateId, shiurId);
    }

    console.log("Finished building schedule");
  } catch (err) {
    console.error(err);
  }
}


async function main() {
//   console.log(startDateId);
const startDateId = await getDateId(scheduleStart);
await buildFullSchedule(startDateId, mishnaIdStart);
await pool.end();
}

main().catch(console.error);

