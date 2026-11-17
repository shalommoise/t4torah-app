const { getCastosConfig } = require('./castos');
const { getMailchimpConfig } = require('./mailchimp');

// Settings for the Time4Tefilla pipeline (src/services/tefilla). Like
// ./mailchimp.js, this doesn't load dotenv or ./env.js; callers pass the
// environment in.
//
// Modes, safest first:
// - dry-run: convert, render and write previews to OUTBOX_DIR; nothing is
//   created in Castos or Mailchimp and send_log is not touched;
// - test: the Castos TEST show (CASTOS_PODCAST_ID) and the Mailchimp test
//   audience (MAILCHIMP_TEST_AUDIENCE_ID);
// - live: the Time4Tefilla show and audience.
//
// TEFILLA_SEND_MODE is the most this server will do (default dry-run); an
// upload may ask for that mode or a safer one, never more.

const MODES = ['dry-run', 'test', 'live'];

const DEFAULTS = {
  TEFILLA_SEND_MODE: 'dry-run',
  OUTBOX_DIR: 'outbox',
};

const PODCAST_ID_PATTERN = /^\d+$/;

const isBlank = (value) => value === undefined || value === null || String(value).trim() === '';

const pick = (env, names) =>
  Object.fromEntries(names.filter((name) => env[name] !== undefined).map((name) => [name, env[name]]));

const readValue = (env, name) => (isBlank(env[name]) ? DEFAULTS[name] || '' : String(env[name]).trim());

/**
 * The highest mode this server allows (TEFILLA_SEND_MODE).
 *
 * @param {Record<string, string|undefined>} [env]
 * @returns {'dry-run'|'test'|'live'}
 */
const getMaxTefillaMode = (env = process.env) => {
  const mode = readValue(env, 'TEFILLA_SEND_MODE');
  if (!MODES.includes(mode)) {
    throw new Error(`TEFILLA_SEND_MODE must be one of: ${MODES.join(', ')} (got "${mode}")`);
  }
  return mode;
};

/**
 * The modes an upload may ask for: TEFILLA_SEND_MODE and every safer one.
 *
 * @param {Record<string, string|undefined>} [env]
 * @returns {('dry-run'|'test'|'live')[]}
 */
const getAllowedTefillaModes = (env = process.env) => MODES.slice(0, MODES.indexOf(getMaxTefillaMode(env)) + 1);

/** Runs `read` and returns its problem message (without `prefix`) instead of throwing. */
const collect = (problems, read, prefix) => {
  try {
    return read();
  } catch (error) {
    problems.push(String(error.message).replace(prefix, ''));
    return null;
  }
};

/**
 * Reads and validates what `mode` needs. Throws one error listing every
 * problem; messages name variables, never the API keys' values.
 *
 * The publish and send times are the daily send's (CASTOS_PUBLISH_TIME and
 * SEND_TIME, both 05:15 by default, in SEND_TIMEZONE). The episode must not be
 * published after the email goes out, so CASTOS_PUBLISH_TIME may not be later
 * than SEND_TIME.
 *
 * @param {'dry-run'|'test'|'live'} mode
 * @param {Record<string, string|undefined>} [env]
 * @returns {{
 *   mode: 'dry-run'|'test'|'live',
 *   timeZone: string,
 *   publishTime: string,
 *   sendTime: string,
 *   outboxDir: string,
 *   castos: { apiKey: string, podcastId: string } | null,
 *   mailchimp: ReturnType<typeof getMailchimpConfig> | null,
 * }}
 */
const getTefillaConfig = (mode, env = process.env) => {
  if (!MODES.includes(mode)) {
    throw new Error(`Time4Tefilla mode must be one of: ${MODES.join(', ')} (got "${mode}")`);
  }
  const problems = [];
  const live = mode === 'live';
  const sends = mode !== 'dry-run';

  // Castos: the times always (a dry-run plans them too); the key and show only to send.
  const castosEnv = sends ? env : { CASTOS_API_KEY: 'unused', CASTOS_PODCAST_ID: '1', ...pick(env, ['CASTOS_PUBLISH_TIME', 'SEND_TIMEZONE']) };
  const castosBase = collect(problems, () => getCastosConfig(castosEnv), 'Invalid Castos config: ');

  const tefillaPodcastId = readValue(env, 'CASTOS_TEFILLA_PODCAST_ID');
  if (tefillaPodcastId && !PODCAST_ID_PATTERN.test(tefillaPodcastId)) {
    problems.push(`CASTOS_TEFILLA_PODCAST_ID must be a number (got "${tefillaPodcastId}")`);
  }
  if (live && !tefillaPodcastId) {
    problems.push('CASTOS_TEFILLA_PODCAST_ID (the Time4Tefilla show) is required for a live send');
  }
  if (sends && castosBase && tefillaPodcastId && tefillaPodcastId === castosBase.testPodcastId) {
    problems.push('CASTOS_TEFILLA_PODCAST_ID and CASTOS_PODCAST_ID (the test show) must be different shows');
  }

  // Mailchimp: the Time4Tefilla sender details, and the audience for the mode.
  const liveAudience = readValue(env, 'MAILCHIMP_TEFILLA_AUDIENCE_ID');
  const testAudience = readValue(env, 'MAILCHIMP_TEST_AUDIENCE_ID');
  if (live && !liveAudience) {
    problems.push('MAILCHIMP_TEFILLA_AUDIENCE_ID is required for a live send');
  }
  if (mode === 'test' && !testAudience) {
    problems.push('MAILCHIMP_TEST_AUDIENCE_ID is required for a test send');
  }
  if (sends && liveAudience && liveAudience === testAudience) {
    problems.push('MAILCHIMP_TEST_AUDIENCE_ID must not be the Time4Tefilla audience');
  }
  for (const name of ['MAILCHIMP_TEFILLA_FROM_NAME', 'MAILCHIMP_TEFILLA_REPLY_TO']) {
    if (sends && isBlank(env[name])) {
      problems.push(`${name} is required`);
    }
  }
  const mailchimpEnv = {
    ...env,
    MAILCHIMP_AUDIENCE_ID: (live ? liveAudience : testAudience) || 'unused',
    MAILCHIMP_FROM_NAME: readValue(env, 'MAILCHIMP_TEFILLA_FROM_NAME') || 'unused',
    MAILCHIMP_REPLY_TO: readValue(env, 'MAILCHIMP_TEFILLA_REPLY_TO') || 'unused@example.org',
    ...(!sends && { MAILCHIMP_API_KEY: 'unused-us1' }),
  };
  const mailchimp = collect(
    problems,
    () => {
      try {
        return getMailchimpConfig(mailchimpEnv);
      } catch (error) {
        // Name the variable that was actually set.
        throw new Error(error.message.replace(/\bMAILCHIMP_REPLY_TO\b/g, 'MAILCHIMP_TEFILLA_REPLY_TO'));
      }
    },
    'Invalid Mailchimp config: '
  );

  if (castosBase && mailchimp && castosBase.publishTime > mailchimp.sendTime) {
    problems.push(
      `CASTOS_PUBLISH_TIME (${castosBase.publishTime}) must not be later than SEND_TIME (${mailchimp.sendTime}): ` +
        'the email would link to an episode that is not out yet'
    );
  }
  if (castosBase && mailchimp && castosBase.timeZone !== mailchimp.sendTimeZone) {
    problems.push('Castos and Mailchimp must use the same SEND_TIMEZONE');
  }

  if (problems.length) {
    throw new Error(`Invalid Time4Tefilla config (${mode}): ${problems.join('; ')}`);
  }

  return {
    mode,
    timeZone: mailchimp.sendTimeZone,
    publishTime: castosBase.publishTime,
    sendTime: mailchimp.sendTime,
    outboxDir: readValue(env, 'OUTBOX_DIR'),
    castos: sends ? { apiKey: castosBase.apiKey, podcastId: live ? tefillaPodcastId : castosBase.testPodcastId } : null,
    mailchimp: sends ? mailchimp : null,
  };
};

/**
 * The config for an upload that asked for `requestedMode` (default dry-run).
 * Throws with `status` 400 for an unknown mode, 403 for a mode above
 * TEFILLA_SEND_MODE, and 503 for a server config problem.
 *
 * @param {string|undefined|null} requestedMode
 * @param {Record<string, string|undefined>} [env]
 * @returns {ReturnType<typeof getTefillaConfig>}
 */
const getTefillaRunConfig = (requestedMode, env = process.env) => {
  const mode = requestedMode == null || String(requestedMode).trim() === '' ? 'dry-run' : String(requestedMode).trim();
  if (!MODES.includes(mode)) {
    throw Object.assign(new Error(`mode must be one of: ${MODES.join(', ')} (got "${mode}")`), { status: 400 });
  }
  let allowed;
  try {
    allowed = getAllowedTefillaModes(env);
  } catch (error) {
    throw Object.assign(error, { status: 503 });
  }
  if (!allowed.includes(mode)) {
    throw Object.assign(
      new Error(`mode "${mode}" is not allowed on this server (TEFILLA_SEND_MODE is "${allowed[allowed.length - 1]}")`),
      { status: 403 }
    );
  }
  try {
    return getTefillaConfig(mode, env);
  } catch (error) {
    throw Object.assign(error, { status: 503 });
  }
};

module.exports = { MODES, DEFAULTS, getMaxTefillaMode, getAllowedTefillaModes, getTefillaConfig, getTefillaRunConfig };
