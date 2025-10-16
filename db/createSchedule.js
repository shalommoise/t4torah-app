const { connection } = require("./mysql");
require('dotenv').config();

const scheduleStart = process.env.SCHEDULE_START;
// console.log(scheduleStart)
const mishnaIdStart = process.env.MISHNA_START_ID;

// Get start Date
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

// now that we have start date and start mishna we need logic to add into schesule

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
//   shiur_type VARCHAR(25),
//   time4mishna_shiur_id INT,
//   date_id INT NOT NULL,

const getDateDetails = async (date_id) => {
    let connection;
    try {
        connection = await getConnection();
        const [rows] = await connection.query(
            `SELECT * 
             FROM dates_table 
             WHERE date_id = ?`,
            [dateId]
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
const insertIntoSchedule = async (scheduleObj) =>{}
const calculateSchedule = (dateObj,shiurObj)=>{
    const scheduleObj = {};
    // figure out what shiur it should be based on the date
    if(dateObj.is_yom_tov) {
        // skip 
    } 
    if (dateObj.day_of_week === "Friday" || dateObj.day_of_week === "Shabbos") {
        // Chazara
        
    } else {
        // regular schedule 
        scheduleObj.shiur_type = "regular";
        scheduleObj.date_id = dateObj.date_id;
        scheduleObj.shiur_id = shiurObj.shiur_id;
    }

    if(dateObj.special_date =="erev"){
// needs REGEX 
// get Yom TOV Summary
scheduleObj.additonal_notice = dateObj.special_date
    }
}


