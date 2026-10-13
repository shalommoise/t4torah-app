const { PROGRAM_TITLES, stripLinks } = require('./dailySections');

/**
 * The subject format, in one place. Tokens:
 *   {program}    Time4Mishna | Time4Nach | Time4Mishna & Time4Nach
 *   {weekday}    Monday
 *   {day}        28
 *   {month}      Sep
 *   {hebrewDate}  26 Tishrei   (dates_table.hebrew_date without the year)
 *   {specialDate} Chol HaMoed Sukkos (dates_table.special_date, links removed)
 * Each ` | {token}` part is dropped when that value is empty.
 */
const SUBJECT_FORMAT = '{program} – {weekday} {day} {month} | {hebrewDate} | {specialDate}';
const OPTIONAL_TOKENS = ['hebrewDate', 'specialDate'];

// Fixed names rather than Intl, whose short month varies by ICU version
// (e.g. en-GB "Sept").
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * `17 Tishrei 5787` → `17 Tishrei`; `null` when empty.
 *
 * @param {string|null|undefined} hebrewDate
 * @returns {string|null}
 */
const stripHebrewYear = (hebrewDate) => {
  if (!hebrewDate) {
    return null;
  }
  return String(hebrewDate).replace(/\s+\d{4}$/, '').trim() || null;
};

/**
 * Builds the email subject for a day's message, e.g.
 * `Time4Mishna – Monday 28 Sep | 26 Tishrei`, or with a special date
 * `Time4Mishna – Monday 28 Sep | 17 Tishrei | Chol HaMoed Sukkos`.
 *
 * @param {object} dateRow A dates_table row (`gregorian_date`, `hebrew_date`, `special_date`).
 * @param {'time4mishna'|'time4nach'|'combined'} program
 * @returns {string}
 */
const buildSubject = (dateRow, program) => {
  if (!PROGRAM_TITLES[program]) {
    throw new Error(`Unknown program: ${program}`);
  }
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec((dateRow && dateRow.gregorian_date) || '');
  if (!match) {
    throw new Error('buildSubject requires a dates_table row with a YYYY-MM-DD gregorian_date');
  }
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  const hebrewDate = stripHebrewYear(dateRow.hebrew_date);
  const specialDate = stripLinks(dateRow.special_date);

  const format = OPTIONAL_TOKENS.reduce(
    (fmt, token) => ({ hebrewDate, specialDate }[token] ? fmt : fmt.replace(` | {${token}}`, '')),
    SUBJECT_FORMAT
  );
  const values = {
    program: PROGRAM_TITLES[program],
    weekday: WEEKDAYS[date.getUTCDay()],
    day: String(date.getUTCDate()),
    month: MONTHS[date.getUTCMonth()],
    hebrewDate,
    specialDate,
  };
  return format.replace(/\{(\w+)\}/g, (_match, token) => values[token]);
};

module.exports = { SUBJECT_FORMAT, buildSubject, stripHebrewYear };
