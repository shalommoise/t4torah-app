// HTTP hardening settings for the API server. Like ./mailchimp.js, this
// doesn't load dotenv; callers pass the environment in.

const DEFAULTS = {
  RATE_LIMIT_WINDOW_MS: 15 * 60 * 1000,
  RATE_LIMIT_MAX: 300,
  RATE_LIMIT_CALENDAR_MAX: 30,
};

const readPositiveInt = (env, name) => {
  const raw = env[name];
  if (raw === undefined || raw === null || String(raw).trim() === '') {
    return DEFAULTS[name];
  }
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`${name} must be a positive whole number (got "${raw}")`);
  }
  return value;
};

/**
 * TRUST_PROXY is the number of reverse proxies in front of the app (e.g. 1 on
 * Cloud Run). Unset means none, so rate limits key on the socket address.
 */
const readTrustProxy = (env) => {
  const raw = env.TRUST_PROXY;
  if (raw === undefined || raw === null || String(raw).trim() === '') {
    return false;
  }
  const hops = Number(raw);
  if (!Number.isInteger(hops) || hops < 0) {
    throw new Error(`TRUST_PROXY must be the number of proxies, e.g. 1 (got "${raw}")`);
  }
  return hops;
};

/**
 * @param {Record<string, string|undefined>} [env]
 * @returns {{ windowMs: number, max: number, calendarMax: number, trustProxy: number|false }}
 */
const getHttpConfig = (env = process.env) => ({
  windowMs: readPositiveInt(env, 'RATE_LIMIT_WINDOW_MS'),
  max: readPositiveInt(env, 'RATE_LIMIT_MAX'),
  calendarMax: readPositiveInt(env, 'RATE_LIMIT_CALENDAR_MAX'),
  trustProxy: readTrustProxy(env),
});

module.exports = { getHttpConfig, DEFAULTS };
