const {
  selectDates,
  selectTime4MishnaScheduleByDateId,
  selectTime4NachScheduleByDateId,
} = require('../models/datesModel');

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Validates that a string is a real calendar date in YYYY-MM-DD format
 * (rejects things like "2026-02-30").
 */
const isValidGregorianDate = (dateStr) => {
  if (typeof dateStr !== 'string' || !DATE_REGEX.test(dateStr)) {
    return false;
  }
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
};

/**
 * Looks up the day's schedule row plus its Time4Mishna and Time4Nach shiurim.
 *
 * @param {string} gregorianDate - a YYYY-MM-DD date string.
 * @returns {Promise<{date: object, time4mishna: object[], time4nach: object[]} | null>}
 *   `null` when the date isn't present in `dates_table`.
 */
const getDailyContent = async (gregorianDate) => {
  if (!isValidGregorianDate(gregorianDate)) {
    const error = new Error('gregorianDate must be a valid date in YYYY-MM-DD format');
    error.status = 400;
    throw error;
  }

  const dateRows = await selectDates(
    { gregorianDate, hebrewDate: undefined, isYomTov: null, specialDate: undefined },
    { limit: 1, offset: 0 }
  );
  const dateRow = dateRows[0];
  if (!dateRow) {
    return null;
  }

  const [time4mishna, time4nach] = await Promise.all([
    selectTime4MishnaScheduleByDateId(dateRow.date_id),
    selectTime4NachScheduleByDateId(dateRow.date_id),
  ]);

  return {
    date: dateRow,
    time4mishna,
    time4nach,
  };
};

module.exports = { getDailyContent, isValidGregorianDate };
