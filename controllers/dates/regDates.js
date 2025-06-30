// using node Date API to format the date in the correct way for the project
// node Date API: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date
const millisecondInDay = 86400000;
const todaysDate =new Date;

const correctFormattedDate = (dateObj) =>{

    const year = dateObj.getFullYear();
    const month = dateObj.getMonth()+1 <10 ? `0${dateObj.getMonth()+1}` : dateObj.getMonth()+1;
    const dayOfMonth = dateObj.getDate();
    // console.log(dateObj.getDay())
    return `${year}-${month}-${dayOfMonth}`;
}

const tomorrowsDate = new Date(Date.now() + millisecondInDay)

console.log( correctFormattedDate(todaysDate),"\n tomrrows date: " , correctFormattedDate(tomorrowsDate));
const {getDateRange} = require("./hebDate");

// getDateRange("2025-06-29","2025-07-31")
