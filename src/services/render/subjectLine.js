const { PROGRAM_TITLES, stripLinks } = require('./dailySections');

/**
 * The subject format, in one place, matching the manual Mailchimp send. Tokens:
 *   {shiur}       Shabbos 17.3-17.6  (the day's shiur labels joined with ` & `;
 *                 the program title, e.g. Time4Mishna, when there are none)
 *   {weekday}     Wed
 *   {day}         28
 *   {month}       Oct
 *   {specialDate} Chol HaMoed Sukkos (dates_table.special_date, links removed)
 * The ` | {specialDate}` part is dropped when there is no special date.
 */
const SUBJECT_FORMAT = '{shiur} ({weekday} {day} {month}) | {specialDate}';
const OPTIONAL_TOKENS = ['specialDate'];

// Fixed names rather than Intl, whose short month varies by ICU version
// (e.g. en-GB "Sept").
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Builds the email subject for a day's message, e.g.
 * `Shabbos 17.3-17.6 (Wed 28 Oct)`, or with a special date
 * `Sukkah 2.1-2.4 (Mon 28 Sep) | Chol HaMoed Sukkos`.
 *
 * @param {object} dateRow A dates_table row (`gregorian_date`, `special_date`).
 * @param {'time4mishna'|'time4nach'|'combined'} program
 * @param {string[]} [shiurLabels] The day's shiur labels (see dailySections.getSections).
 * @returns {string}
 */
const buildSubject = (dateRow, program, shiurLabels = []) => {
  if (!PROGRAM_TITLES[program]) {
    throw new Error(`Unknown program: ${program}`);
  }
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec((dateRow && dateRow.gregorian_date) || '');
  if (!match) {
    throw new Error('buildSubject requires a dates_table row with a YYYY-MM-DD gregorian_date');
  }
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  const specialDate = stripLinks(dateRow.special_date);
  const labels = shiurLabels.filter(Boolean);

  const format = OPTIONAL_TOKENS.reduce(
    (fmt, token) => ({ specialDate }[token] ? fmt : fmt.replace(` | {${token}}`, '')),
    SUBJECT_FORMAT
  );
  const values = {
    shiur: labels.length ? labels.join(' & ') : PROGRAM_TITLES[program],
    weekday: WEEKDAYS[date.getUTCDay()],
    day: String(date.getUTCDate()),
    month: MONTHS[date.getUTCMonth()],
    specialDate,
  };
  return format.replace(/\{(\w+)\}/g, (_match, token) => values[token]);
};

module.exports = { SUBJECT_FORMAT, buildSubject };
