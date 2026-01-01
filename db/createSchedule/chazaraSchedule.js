const { getConnection, pool } = require("../mysql.js");
const getFridayIds = async (day) => {
    let connection;
    try {
        connection = await getConnection();
        const [rows] = await connection.query(
            `SELECT date_id
             FROM dates_table 
             WHERE day_of_week=?`,
            [day]
        );

        if (rows.length === 0) {
            console.warn(`No id found for ${date}`);
            return null;
        }
        return rows

    } catch (err) {
        console.error("Error getting date_id:", err.message);
        throw err; // rethrow so the caller knows it failed
    } finally {
        if (connection) {
            connection.release();
        }
    }
}

const getfridayIsInSchedule = async (dateIdArr) => {
    let connection;
    try {
        connection = await getConnection();
        const [rows] = await connection.query(
            `SELECT daily_schedule_id
             FROM time4mishna_daily_schedule 
             WHERE date_id IN (?)`,
            [dateIdArr]
        );

        if (rows.length === 0) {
            console.warn(`No id found for $these dates`);
            return null;
        }
        return rows

    } catch (err) {
        console.error("Error getting date_id:", err.message);
        throw err; // rethrow so the caller knows it failed
    } finally {
        if (connection) {
            connection.release();
        }
    }
}

const checkIfShiurExists = async (shiurArr) => {
    let connection;
    try {
        connection = await getConnection();
        const [rows] = await connection.query(
            `SELECT *
             FROM time4mishna_daily_schedule 
             WHERE date_id in (?)`,
            [shiurArr]
        );

        if (rows.length === 0) {
            console.warn(`No shiur found for shiur id  = ${shiur_id}`);
            return null;
        }
        console.log(rows)
        return rows;
    } catch (err) {
        console.error("Error getting shiur:", err.message);
        throw err; // rethrow so the caller knows it failed
    } finally {
        if (connection) {
            connection.release();
        }
    }
}


getFridayIds("Friday")
    .then((res) => {
        idArr = res.map((items) => [items.date_id]);
        return getfridayIsInSchedule(idArr)
        .then((schdulesIds)=>{
            // console.log(schdulesIds)
            const example = schdulesIds[95].daily_schedule_id;
            const arr = [example -5, example - 4, example -3 , example-2, example -1]
           checkIfShiurExists(arr)
           // filter for shiur_type = regular 
           //get list of time4mishnashiur id
           // get start mishna + end mishna -
           // creat titile and modify "example"
        })
    })