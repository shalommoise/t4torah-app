//  add dates
const {getDateRange} = require("../controllers/dates/hebDate")
// todays date
const startDate = "2025-05-01";
const endDate = "2035-12-31";

  async function createDates() {
  // Simulate async work
  const result =  getDateRange(startDate, endDate).then(dateRange => {
    let str = `INSERT INTO dates_table (gregorian_date, hebrew_date,hebrew_date_he,day_of_week, is_yom_tov)VALUES`;
    dateRange.forEach(dateItem => {
        // date_id	gregorian_date	hebrew_date	hebrew_date_he	day_of_week	is_yom_tov
        const {date,hdate,hebrewDate, dayOfWeek, isYomTov } = dateItem;
        str += `('${date}','${hdate}','${hebrewDate}','${dayOfWeek}', ${isYomTov}),`
    });
   str = str.substring(0, str.length - 1);
    str+= ";";
    return str;
  })
  .catch(error => {
    console.error('Error fetching date range:', error);
  });
  return result;
};

module.exports = createDates;