// Settings for the in-app scheduler (src/scheduler). Like ./send.js, this
// doesn't load dotenv or ./env.js; callers pass the environment in.
//
// The scheduler is off unless SCHEDULER_ENABLED=true, so local and test copies
// of the app never send. Whether it sends for real is still decided by
// SEND_MODE: `live` sends, `dry-run` only writes previews.

const DEFAULTS = {
  SCHEDULER_ENABLED: 'false',
  SCHEDULER_EVENING_TIME: '21:00',
  SCHEDULER_MORNING_TIME: '04:30',
  SCHEDULER_CASTOS: 'true',
  SCHEDULER_CASTOS_DAYS: '7',
  SEND_TIMEZONE: 'Europe/London',
};

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;
const MAX_CASTOS_DAYS = 30;

const isBlank = (value) => value === undefined || value === null || String(value).trim() === '';

const readValue = (env, name) => (isBlank(env[name]) ? DEFAULTS[name] : String(env[name]).trim());

const isValidTimeZone = (timeZone) => {
  try {
    new Intl.DateTimeFormat('en-GB', { timeZone });
    return true;
  } catch (error) {
    return false;
  }
};

/**
 * `HH:MM` → a daily cron expression (`M H * * *`).
 *
 * @param {string} time
 * @returns {string}
 */
const timeToCron = (time) => {
  const [, hour, minute] = TIME_PATTERN.exec(time);
  return `${Number(minute)} ${Number(hour)} * * *`;
};

/**
 * Reads and validates the scheduler settings. Throws one error listing every
 * problem, so a typo fails loudly at startup.
 *
 * @param {Record<string, string|undefined>} [env]
 * @returns {{
 *   enabled: boolean,
 *   eveningTime: string,
 *   morningTime: string,
 *   castos: boolean,
 *   castosDays: number,
 *   timeZone: string,
 * }}
 */
const getSchedulerConfig = (env = process.env) => {
  const problems = [];
  const readBoolean = (name) => {
    const value = readValue(env, name);
    if (value !== 'true' && value !== 'false') {
      problems.push(`${name} must be true or false (got "${value}")`);
    }
    return value === 'true';
  };
  const readTime = (name) => {
    const value = readValue(env, name);
    if (!TIME_PATTERN.test(value)) {
      problems.push(`${name} must be HH:MM, e.g. ${DEFAULTS[name]} (got "${value}")`);
    }
    return value;
  };

  const enabled = readBoolean('SCHEDULER_ENABLED');
  const castos = readBoolean('SCHEDULER_CASTOS');
  const eveningTime = readTime('SCHEDULER_EVENING_TIME');
  const morningTime = readTime('SCHEDULER_MORNING_TIME');

  const daysValue = readValue(env, 'SCHEDULER_CASTOS_DAYS');
  const castosDays = Number(daysValue);
  if (!/^\d+$/.test(daysValue) || castosDays < 1 || castosDays > MAX_CASTOS_DAYS) {
    problems.push(`SCHEDULER_CASTOS_DAYS must be a whole number from 1 to ${MAX_CASTOS_DAYS} (got "${daysValue}")`);
  }

  const timeZone = readValue(env, 'SEND_TIMEZONE');
  if (!isValidTimeZone(timeZone)) {
    problems.push(`SEND_TIMEZONE must be an IANA time zone, e.g. Europe/London (got "${timeZone}")`);
  }

  if (problems.length) {
    throw new Error(`Invalid scheduler config: ${problems.join('; ')}`);
  }
  return { enabled, eveningTime, morningTime, castos, castosDays, timeZone };
};

module.exports = { DEFAULTS, MAX_CASTOS_DAYS, getSchedulerConfig, timeToCron };
