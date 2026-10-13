const { CHANNELS, MODES, DEFAULT_MODE } = require('../services/senders');
const { PROGRAMS } = require('../services/render/dailyMessage');

// Deliberately doesn't load dotenv or ./env.js (which opens the MySQL pool);
// callers such as the CLI job load .env and pass process.env in.

const DEFAULTS = {
  SEND_MODE: DEFAULT_MODE,
  SEND_CHANNELS: 'email,whatsapp',
  SEND_PROGRAMS: 'time4mishna,time4nach',
  OUTBOX_DIR: 'outbox',
};

const isBlank = (value) => value === undefined || value === null || String(value).trim() === '';

const readValue = (env, name) => (isBlank(env[name]) ? DEFAULTS[name] : String(env[name]).trim());

/**
 * Parses a comma-separated list, trimming and de-duplicating entries, and
 * throws if any entry isn't in `allowed`.
 */
const readList = (env, name, allowed) => {
  const values = [
    ...new Set(
      readValue(env, name)
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean)
    ),
  ];
  const unknown = values.filter((value) => !allowed.includes(value));
  if (unknown.length) {
    throw new Error(`${name} has unknown value(s): ${unknown.join(', ')}. Allowed: ${allowed.join(', ')}`);
  }
  if (!values.length) {
    throw new Error(`${name} must list at least one of: ${allowed.join(', ')}`);
  }
  return values;
};

/**
 * Reads the send configuration from environment variables. Unset or blank
 * variables use the defaults; an invalid value throws, so a typo (e.g.
 * `SEND_MODE=Live`) fails loudly instead of changing behaviour silently.
 *
 * @param {Record<string, string|undefined>} [env]
 * @returns {{
 *   mode: 'dry-run'|'live',
 *   channels: ('email'|'whatsapp')[],
 *   programs: ('time4mishna'|'time4nach'|'combined')[],
 *   outboxDir: string,
 * }}
 */
const getSendConfig = (env = process.env) => {
  const mode = readValue(env, 'SEND_MODE');
  if (!MODES.includes(mode)) {
    throw new Error(`SEND_MODE must be one of: ${MODES.join(', ')} (got "${mode}")`);
  }

  return {
    mode,
    channels: readList(env, 'SEND_CHANNELS', CHANNELS),
    programs: readList(env, 'SEND_PROGRAMS', PROGRAMS),
    outboxDir: readValue(env, 'OUTBOX_DIR'),
  };
};

module.exports = { DEFAULTS, getSendConfig };
