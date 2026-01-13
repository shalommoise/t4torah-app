

const fs = require("fs");

const fileWIthMishnayos = fs.readFileSync("./db/data/t4mshiurim_splitMIhsnayos.csv", "utf-8").split("\n");
const headings = fileWIthMishnayos.shift().split(',').map(h => h.trim().replace(/\r/g, "").replace(/^\uFEFF/, ''));
const mishnayosArr = fileWIthMishnayos.map((item) => {
    const obj = {};
    const arr = item.split(",")
    headings.forEach((heading, i) => {
        const value = arr[i] ? arr[i].replace(/\r/g, "") : "";
        obj[heading] = value;
    });
    return obj;
})
const { getConnection, pool } = require("./mysql");

const getMasechtaId = async (masechta) => {
    let connection;
    try {
        connection = await getConnection();
        const [rows] = await connection.query(
            `SELECT masechta_id 
             FROM masechta_table 
             WHERE masechta_name = ?`,
            [masechta]
        );

        if (rows.length === 0) {
            console.warn(`No masechta found with name "${masechta}"`);
            return null;
        }

        return rows[0].masechta_id;

    } catch (err) {
        console.error("Error getting masechta ID:", err.message);
        throw err;
    } finally {
        if (connection) {
            connection.release();
        }
    }
};


const getmishnaId = async (masechtaId, perekNumber, mishnaNumber) => {
    let connection;
    try {
        connection = await getConnection();
        const [rows] = await connection.query(
            `SELECT mishna_id 
             FROM mishnayos_table 
             WHERE masechta_id = ? 
               AND perek = ? 
               AND mishna = ?`,
            [Number(masechtaId), Number(perekNumber), Number(mishnaNumber)]
        );

        if (rows.length === 0) {
            console.warn(`No mishna found for masechtaId=${masechtaId}, perek=${perekNumber}, mishna=${mishnaNumber}`);
            return null;
        }

        return rows[0].mishna_id;

    } catch (err) {
        console.error("Error getting mishna ID:", err.message);
        throw err; // rethrow so the caller knows it failed
    } finally {
        if (connection) {
            connection.release();
        }
    }
};


const addShiur = async (title, startMishna, endMishna) => {
    let connection;
    try {
        connection = await getConnection();
        await connection.query(
            `INSERT INTO time4mishna_shiurim (shiur_title, start_mishna, end_mishna)
             VALUES (?, ?, ?)`,
            [title, startMishna, endMishna]
        );
        // console.log("Shiur added successfully:", title);
    } catch (err) {
        console.error("Error adding shiur:", err.message);
        throw err; // rethrow if you want the calling code to know it failed
    } finally {
        if (connection) {
            connection.release();
        }
    }
};

const insertToShiurim = async (arr, i = 0) => {
    if (i >= arr.length - 1) {
        console.log("✅ All Mishna shiurim added.");
        // await pool.end();
        return;
    }

    const { shiurTitle, firstMasechta, lastMasechta, firstPerek, firstMishna, lastPerek, lastMishna } = arr[i];
    try {
        const firstMasechtaId = await getMasechtaId(firstMasechta);
        const lastMasechtaId = await getMasechtaId(lastMasechta);
        const firstMishnaId = await getmishnaId(firstMasechtaId, firstPerek, firstMishna);
        const lastMishnaId = await getmishnaId(lastMasechtaId, lastPerek, lastMishna);
        await addShiur(shiurTitle, firstMishnaId, lastMishnaId);

    } catch (err) {
        console.error(`❌ Error adding shiur: ${shiurTitle}`, err);
    }
    insertToShiurim(arr, i + 1);
};


module.exports = { insertToShiurim, mishnayosArr }
