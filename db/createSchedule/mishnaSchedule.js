require('dotenv').config();
const {runSchedule} = require("./schedulemaker");
const scheduleStart = process.env.SCHEDULE_START ? process.env.SCHEDULE_START : "2025-05-01";
const mishnaIdStart = process.env.MISHNA_START_ID ? process.env.MISHNA_START_ID : 1;


const runMishnaSchedule = async()=>{
  return runSchedule(scheduleStart,mishnaIdStart,"time4mishna").catch(console.error); 
}

module.exports = {runMishnaSchedule}