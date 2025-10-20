//  add dates
const { getDateRange } = require("../controllers/dates/hebDate");
// todays date
const startDate = "2025-05-01";
const endDate = "2025-05-03";

async function createDates() {
  console.log(`Attempting to add date range ${startDate} - ${endDate} to dates table.`);
  const dateTableQuery = `INSERT INTO dates_table (gregorian_date, hebrew_date,hebrew_date_he,day_of_week,is_yom_tov,special_date)
  VALUES ?`;
  // Simulate async work
  return getDateRange(startDate, endDate).then(dateRange => {
    return {
      query: dateTableQuery, values: dateRange.map(dateItem => {

        const { date, hdate, hebrewDate, dayOfWeek, isYomTov, specialDay } = dateItem;
        const dateItemToSend = { date, hdate, hebrewDate, dayOfWeek, isYomTov, specialDay };
        return Object.values(dateItemToSend);

      })
    }
  })
    .catch(error => {
      console.error('Error fetching date range:', error);
    });
};

module.exports = createDates;