const { getConnection, pool } = require("../mysql.js");
const { checkForMulitplMasechtos } = require("../../utils/utils.js")
const getDayIds = async (day) => {
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
            console.warn(`No id found for ${day}`);
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

const getDayIsInSchedule = async (dateIdArr) => {
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
    const allFridays = await getDayIds("Friday");
    if (!allFridays || allFridays.length === 0) {
        console.log("No Fridays found. Skipping chazara schedule creation.");
        return;
    }
    const allFridaysIds = allFridays.map((items) => items.date_id);
    const allFridaysInActiveSchedule = await getDayIsInSchedule(allFridaysIds);

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
    } catch (err) {
        console.error(err);
    }
}

// shabbos schedule


const getMaschtosBySeder = async (sederId) => {
    let connection;
    try {
        connection = await getConnection();
        const [rows] = await connection.query(
            `SELECT masechta_id,number_of_perakim, masechta_name
             FROM masechta_table 
             WHERE seder_id=?`,
            [sederId]
        );
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

const shabbosChazaraSchedule = async (num) => {
    const sederMasechtos = await getMaschtosBySeder(num);
    const masechotsIndex = [];
    sederMasechtos.forEach((masechta) => {
        for (let i = 1; i <= masechta.number_of_perakim; i++) {
            masechotsIndex.push({masechta_id: masechta.masechta_id, masechta_name: masechta.masechta_name, perek: i});
        }
    });

    const masechtosToLearn = [];
    for (let i = 0; i < masechotsIndex.length; i+=2) {
        const masechta = masechotsIndex[i];
        const nextMasechta = masechotsIndex[i + 1];
        if (nextMasechta && nextMasechta.masechta_name !== masechta.masechta_name) {
            masechtosToLearn.push(`${masechta.masechta_name} ${masechta.perek} - ${nextMasechta.masechta_name} ${nextMasechta.perek}`);
        } else if (nextMasechta && nextMasechta.masechta_name === masechta.masechta_name) {
            masechtosToLearn.push(`${masechta.masechta_name} ${masechta.perek}-${nextMasechta.perek}`);
        } else {
            masechtosToLearn.push(`${masechta.masechta_name} ${masechta.perek}`);
        }
    }

     return masechtosToLearn;
    
}


const createShabbosSchedule = async () => {
  const shabbosDates = await getDayIds("Shabbos");
  const shabbosInSchedule = await getDayIsInSchedule(shabbosDates.map((item) => item.date_id));
  const zeraimSchedule = await shabbosChazaraSchedule(1);
  const moedSchedule = await shabbosChazaraSchedule(2);
  const nashimSchedule = await shabbosChazaraSchedule(3);
  const nezikinSchedule = await shabbosChazaraSchedule(4);
  const kodshimSchedule = await shabbosChazaraSchedule(5);
  const taharotSchedule = await shabbosChazaraSchedule(6);
  const allShabbosSchedule = [zeraimSchedule, moedSchedule, nashimSchedule, nezikinSchedule, kodshimSchedule, taharotSchedule].flat(); 
 try {
     for (let i = 0; i < shabbosInSchedule.length; i++) {
         const currentShabbosSchedule = shabbosInSchedule[i];
         const additionalNotice = await getFridayAddtionalNotice(currentShabbosSchedule.daily_schedule_id);
         const newNotice = `${allShabbosSchedule[i]} ${additionalNotice ? ` - ${additionalNotice}` : ''}`;
         console.log(newNotice);
         await updatefridayAdditionalNotice(currentShabbosSchedule.daily_schedule_id, newNotice);
     }
      console.log(`Finished building shabbos chazara schedule`);
      await pool.end();
 } catch (error) {
    console.error("Error creating shabbos schedule:", error);
 }
}


module.exports = {getForAllSchedule, createShabbosSchedule}