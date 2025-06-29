// assumes database is already made 
require('dotenv').config();

// const db = process.env.DATABASE_NAME;
var mysql  = require('mysql');
var connection = mysql.createConnection({
  host     : process.env.DATABASE_HOST,
  user     : process.env.DATABASE_USER,
  password : process.env.DATABASE_PASSWORD,
  database : process.env.DATABASE_NAME
});


connection.connect();
 
// fetch util funcs
const {dropTable,createTable} = require("./utils")
const tables = require("./fieldNames.json");
const tableNames = Object.keys(tables);
console.log(tableNames)

// connection.query(`CREATE TABLE dates_table(
   
//     date_id int NOT NULL,
//     gregorian_date varchar(255),
//     hebrew_date varchar(255),
//     day_of_week int,
//     is_yom_tov boolean,
//     extra_data varchar(255),
//     PRIMARY KEY (date_id));`, function (error, results, fields) {
//     if (error) throw error;
//   //   console.log('The solution is: ', results[0].solution);
//   });