// Values written to dates_table.day_of_week by controllers/dates/hebDate.js.
const SEND_WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const NO_SEND_WEEKDAYS = ['Shabbos'];

// is_yom_tov is a MySQL BOOLEAN (tinyint): 0/1, or false/true from JSON.
const isExplicitFalse = (value) => value === false || value === 0;
const isExplicitTrue = (value) => value === true || value === 1;

/**
 * Describes what's wrong with a `dates_table` row for send purposes, or
 * returns `null` when both `day_of_week` and `is_yom_tov` are recognised.
 *
 * @param {{ day_of_week?: unknown, is_yom_tov?: unknown } | null | undefined} dateRow
 * @returns {string|null}
 */
const getCalendarRowProblem = (dateRow) => {
  if (!dateRow) {
    return 'missing date row';
  }
  const dayOfWeek = dateRow.day_of_week;
  if (!SEND_WEEKDAYS.includes(dayOfWeek) && !NO_SEND_WEEKDAYS.includes(dayOfWeek)) {
    return `unrecognised day_of_week: ${JSON.stringify(dayOfWeek === undefined ? null : dayOfWeek)}`;
  }
  const isYomTov = dateRow.is_yom_tov;
  if (!isExplicitFalse(isYomTov) && !isExplicitTrue(isYomTov)) {
    return `unrecognised is_yom_tov: ${JSON.stringify(isYomTov === undefined ? null : isYomTov)}`;
  }
  return null;
};

/**
 * Decides whether the daily send should go out for a given `dates_table` row.
 *
 * Fails closed: sends only on a recognised weekday (Sunday–Friday) when
 * `is_yom_tov` is explicitly false/0. Shabbos, Yom Tov, and any missing or
 * unrecognised value mean no send. Chol HaMoed (not flagged Yom Tov) sends.
 *
 * @param {{ day_of_week?: unknown, is_yom_tov?: unknown } | null | undefined} dateRow
 * @returns {boolean}
 */
const shouldSendOn = (dateRow) =>
  getCalendarRowProblem(dateRow) === null &&
  SEND_WEEKDAYS.includes(dateRow.day_of_week) &&
  isExplicitFalse(dateRow.is_yom_tov);

module.exports = { shouldSendOn, getCalendarRowProblem, SEND_WEEKDAYS };
