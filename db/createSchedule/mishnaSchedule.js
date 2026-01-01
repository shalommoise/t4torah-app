const { pool} = require("../mysql.js");
require('dotenv').config();
const {buildFullSchedule, getDateId} = require("./schedulemaker");
const scheduleStart = process.env.SCHEDULE_START ? process.env.SCHEDULE_START : "2025-05-01";
const mishnaIdStart = process.env.MISHNA_START_ID ? process.env.MISHNA_START_ID : 1;

async function runMishnaSchedule() {
const startDateId = await getDateId(scheduleStart);
await buildFullSchedule(startDateId, mishnaIdStart,"time4mishna");
await pool.end();
}

runMishnaSchedule().catch(console.error);