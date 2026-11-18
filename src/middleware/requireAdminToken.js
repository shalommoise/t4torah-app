const crypto = require('crypto');

const BEARER_PATTERN = /^Bearer[ \t]+(\S+)[ \t]*$/i;
const BASIC_PATTERN = /^Basic[ \t]+([A-Za-z0-9+/=]+)[ \t]*$/i;
const BASIC_REALM = 't4torah admin';

// Hash both sides so timingSafeEqual always compares equal-length buffers and
// the comparison time doesn't depend on (or reveal) the token length.
const digest = (value) => crypto.createHash('sha256').update(value, 'utf8').digest();

const tokensMatch = (provided, expected) => crypto.timingSafeEqual(digest(provided), digest(expected));

/** The password from `Authorization: Basic base64(user:password)`; the user name is ignored. */
const basicPassword = (header) => {
  const match = BASIC_PATTERN.exec(header);
  if (!match) {
    return null;
  }
  const decoded = Buffer.from(match[1], 'base64').toString('utf8');
  const colon = decoded.indexOf(':');
  return colon === -1 ? null : decoded.slice(colon + 1);
};

/**
 * Protects admin-only routes (GET /calendar/export, the Time4Tefilla upload)
 * with `Authorization: Bearer <token>`, matched against SENDS_ADMIN_TOKEN.
 * Fails closed: when the variable is unset or blank, every request gets 503
 * rather than open access.
 *
 * With `allowBasic`, HTTP Basic auth is accepted too, with the same token as
 * the password (any user name), so a browser can open an admin page: it asks
 * for the token once and sends it with the page's own requests.
 *
 * @param {{ getToken?: () => string|undefined, allowBasic?: boolean }} [options]
 *   Reads the env var per request by default.
 */
const requireAdminToken =
  ({ getToken = () => process.env.SENDS_ADMIN_TOKEN, allowBasic = false } = {}) =>
  (req, res, next) => {
    const expected = getToken();
    if (typeof expected !== 'string' || expected.trim() === '') {
      return res.status(503).json({ error: 'Admin API is not configured (SENDS_ADMIN_TOKEN is not set)' });
    }

    const header = req.get('authorization') || '';
    const bearer = BEARER_PATTERN.exec(header);
    const provided = bearer ? bearer[1] : allowBasic ? basicPassword(header) : null;
    if (provided === null || !tokensMatch(provided, expected)) {
      res.set('WWW-Authenticate', allowBasic ? `Basic realm="${BASIC_REALM}", charset="UTF-8"` : 'Bearer');
      return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
  };

module.exports = { requireAdminToken };
