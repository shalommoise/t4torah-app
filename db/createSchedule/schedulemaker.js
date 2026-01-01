const { getConnection,pool } = require("../mysql.js");

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

const getShiur = async (shiur_id, tableName) => {
    let connection;
    try {
        connection = await getConnection();
        const [rows] = await connection.query(
            `SELECT *
             FROM ${tableName}_shiurim 
             WHERE ${tableName}_shiur_id= ?`,
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

const calculateSchedule = (shiur, tableName) => {
    const scheduleObj = {};
    scheduleObj.date_id = shiur.date_id;
    scheduleObj.additonal_notice = shiur.dateObj.special_date;
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
        scheduleObj.shiur_id = shiur[`${tableName}_shiur_id`];
    }
    return scheduleObj;
}

const insertIntoSchedule = async (scheduleObj, tableName) => {
    const { shiur_type, shiur_id, date_id, additonal_notice } = scheduleObj;
    // console.log(shiur_id)
    let connection;
    try {
        connection = await getConnection();
        await connection.query(
            `INSERT INTO ${tableName}_daily_schedule (shiur_type, ${tableName}_shiur_id, date_id, additonal_notice)
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


async function buildFullSchedule(startDateId, startShiurId, tableName) {
    try {
        let dateId = Number(startDateId);
        let shiurId = Number(startShiurId);

        while (true) {

            // stop if either ran out
            if (!dateId || !shiurId) break;

            const [dateObj, shiur] = await Promise.all([
                getDateDetails(dateId),
                getShiur(shiurId, tableName)
            ]);

            // stop when DB has no more
            if (!dateObj || !shiur) break;

            shiur.date_id = dateId;
            shiur.dateObj = dateObj;

            const scheduleObj = calculateSchedule(shiur, tableName);
            console.log(scheduleObj)
            await insertIntoSchedule(scheduleObj, tableName);


            dateId = dateId + 1;
            shiurId = scheduleObj.shiur_id ? shiurId + 1 : shiurId;


        }

        console.log(`Finished building ${tableName} schedule`);
    } catch (err) {
        console.error(err);
    }
}

async function runSchedule(scheduleStart, startShiurId, tableName) {
    const startDateId = await getDateId(scheduleStart);
    await buildFullSchedule(startDateId, startShiurId, tableName);
    await pool.end();
}
module.exports = { runSchedule }
