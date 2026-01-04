const { getConnection, pool } = require("../mysql.js");
const {checkForMulitplMasechtos} = require("../../utils/utils.js")
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
             WHERE date_id in (?) 
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
const getFirstAndLastShiurim = async (shiurim) =>{
    const shiurimIds = shiurim.map((shiur)=> shiur.time4mishna_shiur_id);

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
const getFirstAndLastMishnayos = async (mishnayosShiurim) =>{
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

const getMasechtaNames = async (masechtaIds) =>{
   let connection;
    try {
        connection = await getConnection();
        const [rows] = await connection.query(
            `SELECT masechta_name
             FROM masechta_table 
             WHERE masechta_id in (?)`,
            masechtaIds
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

getFridayIds("Friday")
    .then((res) => {
        idArr = res.map((items) => [items.date_id]);
        return getfridayIsInSchedule(idArr)
        .then((schdulesIds)=>{
            // console.log(schdulesIds)
            const example = schdulesIds[95].daily_schedule_id;
            const arr = [example -5, example - 4, example -3 , example-2, example -1]
           checkIfShiurExists(arr).then((shiurim)=>{
            const firstAndLastShiurim = [shiurim[0], shiurim[shiurim.length-1]]
            getFirstAndLastShiurim(firstAndLastShiurim).then((firstAndlast)=>{
                const firstMishna = firstAndlast[0].start_mishna;
                const lastMishna = firstAndlast[1].end_mishna;
                getFirstAndLastMishnayos([firstMishna,lastMishna])
                .then((mishnayos)=>{
                    // c
                    const titleArr = checkForMulitplMasechtos(mishnayos[0], mishnayos[1]);
                    if(titleArr[0]=== 1) {
                        // 1 maschta
                     getMasechtaNames([titleArr[1]]).then((masechtaNames)=>{
                        console.log(masechtaNames)
                        console.log(`${masechtaNames[0].masechta_name} ${titleArr[2]} - ${titleArr[3]}`)
                        return `${masechtaNames[0].masechta_name} ${titleArr[2]} - ${titleArr[3]}`
                     })

                    } else if(titleArr[0] === 2) {
                        // 2 masechtos 
                        getMasechtaNames([titleArr[1], titleArr[2]]).then((masechtaNames)=>{
                        return `${masechtaNames[0].masechta_name} ${titleArr[3]} - ${masechtaNames[1].masechta_name} ${titleArr[4]}`
                     })
                    }
                })
            })
           })
          
           //get list of time4mishnashiur id
           // get start mishna + end mishna -
           // creat titile and modify "example"
        })
    })