const { pool} = require("../mysql.js");
require('dotenv').config();
const {buildFullSchedule,getDateId} = require("./schedulemaker");
const scheduleStart = process.env.NACH_SCHEDULE_START ? process.env.NACH_SCHEDULE_START : "2025-05-01";
const nachIdStart = process.env.NACH_START_ID ? process.env.NACH_START_ID : 1;
async function runNachSchedule() {

const startDateId = await getDateId(scheduleStart);
await buildFullSchedule(startDateId, nachIdStart,"time4nach");
await pool.end();
}

runNachSchedule().catch(console.error);