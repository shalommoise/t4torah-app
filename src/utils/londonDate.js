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

const TIME_PATTERN = /^(\d{2}):(\d{2})$/;

/**
 * Offset of `timeZone` from UTC at `instant`, in milliseconds (e.g. +1h in BST).
 */
const zoneOffsetMs = (instant, timeZone) => {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
      .formatToParts(instant)
      .map(({ type, value }) => [type, Number(value)])
  );
  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  return asUtc - Math.floor(instant.getTime() / 1000) * 1000;
};

/**
 * The instant at which the wall clock in `timeZone` reads `date` `time`, e.g.
 * 2026-07-01 05:15 Europe/London → 2026-07-01T04:15:00.000Z (BST). Not meant
 * for times inside a clocks-change gap (01:00–02:00 in London).
 *
 * @param {string} date YYYY-MM-DD
 * @param {string} time HH:MM
 * @param {string} [timeZone]
 * @returns {Date}
 */
const zonedTimeToUtc = (date, time, timeZone = TIME_ZONE) => {
  const dateMatch = DATE_PATTERN.exec(date || '');
  const timeMatch = TIME_PATTERN.exec(time || '');
  if (!dateMatch || !timeMatch) {
    throw new TypeError('zonedTimeToUtc requires a YYYY-MM-DD date and an HH:MM time');
  }
  const wallClock = Date.UTC(
    Number(dateMatch[1]),
    Number(dateMatch[2]) - 1,
    Number(dateMatch[3]),
    Number(timeMatch[1]),
    Number(timeMatch[2])
  );
  // Two passes: the offset at the first guess can differ on a clocks-change day.
  const guess = wallClock - zoneOffsetMs(new Date(wallClock), timeZone);
  return new Date(wallClock - zoneOffsetMs(new Date(guess), timeZone));
};

module.exports = { TIME_ZONE, londonToday, londonTomorrow, addDays, zonedTimeToUtc };
