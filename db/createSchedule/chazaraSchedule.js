const { getConnection, pool } = require("../mysql.js");
const { checkForMulitplMasechtos } = require("../../utils/utils.js")
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
             WHERE daily_schedule_id in (?) 
            AND shiur_type = 'regular'
             `,
            [shiurArr]
        );

        if (rows.length === 0) {
            console.warn(`No shiur found for shiur id  = ${shiur_id}`);
            return null;
        }
        // console.log(rows)
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
const getFirstAndLastShiurim = async (shiurim) => {
    const shiurimIds = shiurim.map((shiur) => shiur.time4mishna_shiur_id);

    let connection;
    try {
        connection = await getConnection();
        const [rows] = await connection.query(
            `SELECT *
             FROM time4mishna_shiurim 
             WHERE time4mishna_shiur_id in (?)`,
            [shiurimIds]
        );

        if (rows.length === 0) {
            console.warn(`No shiur found for shiur id  = ${shiurimIds}`);
            return null;
        }
        // console.log(rows)
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
const getFirstAndLastMishnayos = async (mishnayosShiurim) => {
    let connection;
    try {
        connection = await getConnection();
        const [rows] = await connection.query(
            `SELECT masechta_id,perek,mishna
             FROM mishnayos_table 
             WHERE mishna_id in (?)`,
            [mishnayosShiurim]
        );

        if (rows.length === 0) {
            console.warn(`No shiur found for shiur id  = ${mishnayosShiurim}`);
            return null;
        }
        // console.log(rows)
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

const getMasechtaName = async (masechtaId) => {
    let connection;
    try {
        connection = await getConnection();
        const [rows] = await connection.query(
            `SELECT masechta_name
             FROM masechta_table 
             WHERE masechta_id =?`,
            [masechtaId]
        );

        if (rows.length === 0) {
            console.warn(`No shiur found for shiur id  = ${mishnayosShiurim}`);
            return null;
        }
        // console.log(rows)
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

const getFridayAddtionalNotice = async (daily_schedule_id)=>{
    let connection;
    try {
        connection = await getConnection();
        const [rows] = await connection.query(
            `SELECT additional_notice
             FROM time4mishna_daily_schedule 
             WHERE daily_schedule_id=?`,
            [daily_schedule_id]
        );

        if (rows.length === 0) {
            console.warn(`No shiur found for shiur id  = ${mishnayosShiurim}`);
            return null;
        }
        // console.log(rows)
        return rows[0].additional_notice;
    } catch (err) {
        console.error("Error getting shiur:", err.message);
        throw err; // rethrow so the caller knows it failed
    } finally {
        if (connection) {
            connection.release();
        }
    }
}
const updatefridayAdditionalNotice = async (daily_schedule_id, newNotice) => {
  let connection;

  try {
    connection = await getConnection();

    const [result] = await connection.query(
      `UPDATE time4mishna_daily_schedule 
       SET additional_notice = ?
       WHERE daily_schedule_id = ?`,
      [newNotice, daily_schedule_id]
    );

    return result.affectedRows;   // 1 = success, 0 = not found
  } catch (err) {
    console.error("Error updating column:", err.message);
    throw err;
  } finally {
    if (connection) connection.release();
  }
};

const getForAllSchedule = async () => {
    const allFridays = await getFridayIds("Friday");
    const allFridaysIds = allFridays.map((items) => [items.date_id]);
    const allFridaysInActiveSchedule = await getfridayIsInSchedule(allFridaysIds);
    try {
        let i = 0;
        const titles = [];
        while (true) {
            if (i >= allFridaysInActiveSchedule.length - 1) break;
            const fridayChazara = allFridaysInActiveSchedule[i].daily_schedule_id;
             
            const toCheckIfExistisarr = [fridayChazara - 5, fridayChazara - 4, fridayChazara - 3, fridayChazara - 2, fridayChazara - 1];
            const exisitngShiurim = await checkIfShiurExists(toCheckIfExistisarr);
            const firstAndLastShiurim = [exisitngShiurim[0], exisitngShiurim[exisitngShiurim.length - 1]];
            const firstAndLastShiuIds = await getFirstAndLastShiurim(firstAndLastShiurim);
            let title = '';
            if(firstAndLastShiuIds.length === 1) {
              title = firstAndLastShiuIds.shiur_title
            } else {
            const firstMishna = firstAndLastShiuIds[0].start_mishna;
            const lastMishna = firstAndLastShiuIds[1].end_mishna;
            const firstAndLastMishnayos = await getFirstAndLastMishnayos([firstMishna, lastMishna]);
            const titleArr = checkForMulitplMasechtos(firstAndLastMishnayos[0], firstAndLastMishnayos[1]);
            
            if (titleArr[0] === 1) {
                const masechtaName = await getMasechtaName([titleArr[1]]);
                title = `${masechtaName[0].masechta_name} ${titleArr[2]}-${titleArr[3]}`;

            } else if (titleArr[0] === 2) {
                const firstMasechtaName = await getMasechtaName([titleArr[1]]);
                const lastMasechtaName = await getMasechtaName([titleArr[2]]);
                title = `${firstMasechtaName[0].masechta_name} ${titleArr[3]} - ${lastMasechtaName[0].masechta_name} ${titleArr[4]}`
            }
        }
            i = i + 1; 
            const additionalNotice =  await getFridayAddtionalNotice(allFridaysInActiveSchedule[i].daily_schedule_id);
            const newNotice = additionalNotice ? `${title}: ${additionalNotice}` : title;
            console.log(newNotice);
            await updatefridayAdditionalNotice(allFridaysInActiveSchedule[i].daily_schedule_id, newNotice);
            // return title;

        } console.log(`Finished building chazara schedule`);
         await pool.end();
    } catch (err) {
        console.error(err);
    }
}

getForAllSchedule()