const {connection} = require("./mysql");
require('dotenv').config();

const scheduleStart = process.env.SCHEDULE_START;
// console.log(scheduleStart)
const mishnaIdStart = process.env.MISHNA_START_ID;

// Get start Date

connection.query(`SELECT date_id FROM dates_table WHERE gregorian_date='${scheduleStart}';`,(err,results)=>{
    const startDateId = results[0].date_id;
console.log(startDateId);
   
})
// now that we have start date and start mishna we need logic to add into schesule

// in a loop 
// get mishna_shiur start (brachos 1.1-1.4)
connection.query(`SELECT * from time4mishna_shiurim WHERE time4mishna_shiur_id=${mishnaIdStart};`, (err,results)=>{
    console.log(results)
})
// insert into table torah_schedule values (schedule_date_id = startDateId, mishna)

// schedule_date_id INT NOT NULL,
// mishna_audio VARCHAR(30),
// mishna_text VARCHAR(30),
// mishna_summary VARCHAR(30),





