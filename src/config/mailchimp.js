// Mailchimp settings for the live email sender. Like ./send.js, this doesn't
// load dotenv or ./env.js; callers pass the environment in.

const REQUIRED = ['MAILCHIMP_API_KEY', 'MAILCHIMP_AUDIENCE_ID', 'MAILCHIMP_FROM_NAME', 'MAILCHIMP_REPLY_TO'];

const DEFAULTS = {
  SEND_TIME: '05:15',
  SEND_TIMEZONE: 'Europe/London',
};

// Mailchimp only schedules on the quarter hour.
const SEND_TIME_PATTERN = /^([01]\d|2[0-3]):(00|15|30|45)$/;
const SERVER_PREFIX_PATTERN = /^[a-z]+\d+$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
 * `abc123-us21` → `us21`; `null` if the key has no `-<prefix>` suffix.
 *
 * @param {string} apiKey
 * @returns {string|null}
 */
const serverPrefixFromKey = (apiKey) => {
  const match = /-([a-z]+\d+)$/.exec(apiKey || '');
  return match ? match[1] : null;
};

/**
 * True if any MAILCHIMP_* variable is set, i.e. the owner has started
 * configuring Mailchimp (dry-run then validates it and builds the payload).
 *
 * @param {Record<string, string|undefined>} [env]
 * @returns {boolean}
 */
const hasMailchimpConfig = (env = process.env) =>
  Object.keys(env).some((name) => name.startsWith('MAILCHIMP_') && !isBlank(env[name]));

/**
 * Reads and validates the Mailchimp settings. Throws one error listing every
 * problem, so a misconfigured server fails at startup rather than at 05:15.
 *
 * `MAILCHIMP_SERVER_PREFIX` is optional when the API key ends in `-<prefix>`.
 * `SEND_TIME` (default 05:15) is in `SEND_TIMEZONE` (default Europe/London)
 * and must be on the quarter hour.
 *
 * @param {Record<string, string|undefined>} [env]
 * @returns {{
 *   apiKey: string,
 *   serverPrefix: string,
 *   audienceId: string,
 *   fromName: string,
 *   replyTo: string,
 *   sendTime: string,
 *   sendTimeZone: string,
 * }}
 */
const getMailchimpConfig = (env = process.env) => {
  const problems = REQUIRED.filter((name) => isBlank(env[name])).map((name) => `${name} is required`);

  const apiKey = isBlank(env.MAILCHIMP_API_KEY) ? '' : String(env.MAILCHIMP_API_KEY).trim();
  const serverPrefix = isBlank(env.MAILCHIMP_SERVER_PREFIX)
    ? serverPrefixFromKey(apiKey)
    : String(env.MAILCHIMP_SERVER_PREFIX).trim();
  if (apiKey && !serverPrefix) {
    problems.push('MAILCHIMP_SERVER_PREFIX is required when MAILCHIMP_API_KEY has no -<prefix> suffix (e.g. -us21)');
  } else if (serverPrefix && !SERVER_PREFIX_PATTERN.test(serverPrefix)) {
    problems.push(`MAILCHIMP_SERVER_PREFIX must look like us21 (got "${serverPrefix}")`);
  }

  const replyTo = isBlank(env.MAILCHIMP_REPLY_TO) ? '' : String(env.MAILCHIMP_REPLY_TO).trim();
  if (replyTo && !EMAIL_PATTERN.test(replyTo)) {
    problems.push(`MAILCHIMP_REPLY_TO must be an email address (got "${replyTo}")`);
  }

  const sendTime = readValue(env, 'SEND_TIME');
  if (!SEND_TIME_PATTERN.test(sendTime)) {
    problems.push(`SEND_TIME must be HH:MM on the quarter hour, e.g. 05:15 (got "${sendTime}")`);
  }
  const sendTimeZone = readValue(env, 'SEND_TIMEZONE');
  if (!isValidTimeZone(sendTimeZone)) {
    problems.push(`SEND_TIMEZONE must be an IANA time zone, e.g. Europe/London (got "${sendTimeZone}")`);
  }

  if (problems.length) {
    throw new Error(`Invalid Mailchimp config: ${problems.join('; ')}`);
  }

  return {
    apiKey,
    serverPrefix,
    audienceId: String(env.MAILCHIMP_AUDIENCE_ID).trim(),
    fromName: String(env.MAILCHIMP_FROM_NAME).trim(),
    replyTo,
    sendTime,
    sendTimeZone,
  };
};

module.exports = { DEFAULTS, getMailchimpConfig, hasMailchimpConfig, serverPrefixFromKey };
