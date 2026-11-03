// Castos settings for the daily episode job. Like ./mailchimp.js, this doesn't
// load dotenv or ./env.js; callers pass the environment in.
//
// CASTOS_PODCAST_ID is the test show and is the default target. The live
// Time4Mishna show (CASTOS_LIVE_PODCAST_ID) is only used when asked for
// explicitly (`--podcast=live`).

const DEFAULTS = {
  CASTOS_PUBLISH_TIME: '05:15',
  SEND_TIMEZONE: 'Europe/London',
};

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
const PODCAST_ID_PATTERN = /^\d+$/;

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
 * Reads and validates the Castos settings. Throws one error listing every
 * problem. Error messages name variables, never their values for the key.
 *
 * @param {Record<string, string|undefined>} [env]
 * @returns {{
 *   apiKey: string,
 *   testPodcastId: string,
 *   livePodcastId: string|null,
 *   publishTime: string,
 *   timeZone: string,
 * }}
 */
const getCastosConfig = (env = process.env) => {
  const problems = [];
  if (isBlank(env.CASTOS_API_KEY)) {
    problems.push('CASTOS_API_KEY is required');
  }

  const testPodcastId = isBlank(env.CASTOS_PODCAST_ID) ? '' : String(env.CASTOS_PODCAST_ID).trim();
  if (!testPodcastId) {
    problems.push('CASTOS_PODCAST_ID (the test show) is required');
  } else if (!PODCAST_ID_PATTERN.test(testPodcastId)) {
    problems.push(`CASTOS_PODCAST_ID must be a number (got "${testPodcastId}")`);
  }

  const livePodcastId = isBlank(env.CASTOS_LIVE_PODCAST_ID) ? null : String(env.CASTOS_LIVE_PODCAST_ID).trim();
  if (livePodcastId && !PODCAST_ID_PATTERN.test(livePodcastId)) {
    problems.push(`CASTOS_LIVE_PODCAST_ID must be a number (got "${livePodcastId}")`);
  }
  if (livePodcastId && livePodcastId === testPodcastId) {
    problems.push('CASTOS_PODCAST_ID (test) and CASTOS_LIVE_PODCAST_ID must be different shows');
  }

  const publishTime = readValue(env, 'CASTOS_PUBLISH_TIME');
  if (!TIME_PATTERN.test(publishTime)) {
    problems.push(`CASTOS_PUBLISH_TIME must be HH:MM, e.g. 05:15 (got "${publishTime}")`);
  }
  const timeZone = readValue(env, 'SEND_TIMEZONE');
  if (!isValidTimeZone(timeZone)) {
    problems.push(`SEND_TIMEZONE must be an IANA time zone, e.g. Europe/London (got "${timeZone}")`);
  }

  if (problems.length) {
    throw new Error(`Invalid Castos config: ${problems.join('; ')}`);
  }

  return {
    apiKey: String(env.CASTOS_API_KEY).trim(),
    testPodcastId,
    livePodcastId,
    publishTime,
    timeZone,
  };
};

module.exports = { DEFAULTS, getCastosConfig };
