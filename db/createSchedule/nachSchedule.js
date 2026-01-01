
require('dotenv').config();
const {runSchedule} = require("./schedulemaker");
const scheduleStart = process.env.NACH_SCHEDULE_START ? process.env.NACH_SCHEDULE_START : "2025-05-01";
const nachIdStart = process.env.NACH_START_ID ? process.env.NACH_START_ID : 1;

runSchedule(scheduleStart, nachIdStart, "time4nach").catch(console.error);