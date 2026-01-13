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

const getFridayAddtionalNotice = async (daily_schedule_id) => {
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
    if (!allFridays || allFridays.length === 0) {
        console.log("No Fridays found. Skipping chazara schedule creation.");
        return;
    }
    const allFridaysIds = allFridays.map((items) => items.date_id);
    const allFridaysInActiveSchedule = await getfridayIsInSchedule(allFridaysIds);

    if (!allFridaysInActiveSchedule || allFridaysInActiveSchedule.length === 0) {
        console.log("No active schedule found for Fridays. Skipping chazara schedule creation.");
        return;
    }

    try {
        for (let i = 0; i < allFridaysInActiveSchedule.length; i++) {
            const currentFridaySchedule = allFridaysInActiveSchedule[i];
            const fridayChazara = currentFridaySchedule.daily_schedule_id;

            const toCheckIfExistisarr = [fridayChazara - 5, fridayChazara - 4, fridayChazara - 3, fridayChazara - 2, fridayChazara - 1];
            const exisitngShiurim = await checkIfShiurExists(toCheckIfExistisarr);

            if (!exisitngShiurim || exisitngShiurim.length === 0) {
                console.warn(`No existing shiurim found for daily_schedule_id ${fridayChazara}. Skipping.`);
                continue;
            }

            const firstAndLastShiurim = [exisitngShiurim[0], exisitngShiurim[exisitngShiurim.length - 1]];
            const firstAndLastShiuIds = await getFirstAndLastShiurim(firstAndLastShiurim);

            if (!firstAndLastShiuIds || firstAndLastShiuIds.length === 0) {
                console.warn(`No first and last shiur IDs found for daily_schedule_id ${fridayChazara}. Skipping.`);
                continue;
            }

            let title = '';
            if (firstAndLastShiuIds.length === 1) {
                title = firstAndLastShiuIds[0].shiur_title;
            } else {
                const firstMishna = firstAndLastShiuIds[0].start_mishna;
                const lastMishna = firstAndLastShiuIds[1].end_mishna;
                const firstAndLastMishnayos = await getFirstAndLastMishnayos([firstMishna, lastMishna]);

                if (!firstAndLastMishnayos || firstAndLastMishnayos.length === 0) {
                    console.warn(`No first and last mishnayos found for shiur IDs. Skipping.`);
                    continue;
                }

                const titleArr = checkForMulitplMasechtos(firstAndLastMishnayos[0], firstAndLastMishnayos[1]);

                if (titleArr[0] === 1) {
                    const masechtaName = await getMasechtaName([titleArr[1]]);
                    if (!masechtaName || masechtaName.length === 0) {
                        console.warn(`Masechta name not found for ID ${titleArr[1]}. Skipping.`);
                        continue;
                    }
                    title = `${masechtaName[0].masechta_name} ${titleArr[2]}-${titleArr[3]}`;

                } else if (titleArr[0] === 2) {
                    const firstMasechtaName = await getMasechtaName([titleArr[1]]);
                    const lastMasechtaName = await getMasechtaName([titleArr[2]]);

                    if (!firstMasechtaName || firstMasechtaName.length === 0 || !lastMasechtaName || lastMasechtaName.length === 0) {
                        console.warn(`One or both masechta names not found for IDs ${titleArr[1]}, ${titleArr[2]}. Skipping.`);
                        continue;
                    }
                    title = `${firstMasechtaName[0].masechta_name} ${titleArr[3]} - ${lastMasechtaName[0].masechta_name} ${titleArr[4]}`
                }
            }

            const additionalNotice = await getFridayAddtionalNotice(currentFridaySchedule.daily_schedule_id);
            const newNotice = additionalNotice ? `${title}: ${additionalNotice}` : title;
            console.log(newNotice);
            await updatefridayAdditionalNotice(currentFridaySchedule.daily_schedule_id, newNotice);
        }
        console.log(`Finished building chazara schedule`);
        await pool.end();
    } catch (err) {
        console.error(err);
    }
}

module.exports = {getForAllSchedule}