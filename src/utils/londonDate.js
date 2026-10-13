// Europe/London calendar dates for the daily send, without a date library.
// Intl handles BST/GMT; day arithmetic works on calendar dates (not +24h,
// which gives the wrong day on the 25-hour day when the clocks go back).

const TIME_ZONE = 'Europe/London';

const londonDateFormat = new Intl.DateTimeFormat('en-GB', {
  timeZone: TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * The Europe/London calendar date at `instant`, as YYYY-MM-DD.
 *
 * @param {Date} [instant]
 * @returns {string}
 */
const londonToday = (instant = new Date()) => {
  if (!(instant instanceof Date) || Number.isNaN(instant.getTime())) {
    throw new TypeError('londonToday requires a valid Date');
  }
  const parts = Object.fromEntries(
    londonDateFormat.formatToParts(instant).map(({ type, value }) => [type, value])
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
};

/**
 * Adds whole calendar days to a YYYY-MM-DD date.
 *
 * @param {string} date
 * @param {number} days May be negative.
 * @returns {string}
 */
const addDays = (date, days) => {
  const match = DATE_PATTERN.exec(date || '');
  if (!match || !Number.isInteger(days)) {
    throw new TypeError('addDays requires a YYYY-MM-DD date and a whole number of days');
  }
  const result = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]) + days));
  return result.toISOString().slice(0, 10);
};

/**
 * The Europe/London calendar date after the one at `instant`, as YYYY-MM-DD.
 *
 * @param {Date} [instant]
 * @returns {string}
 */
const londonTomorrow = (instant = new Date()) => addDays(londonToday(instant), 1);

module.exports = { TIME_ZONE, londonToday, londonTomorrow, addDays };
