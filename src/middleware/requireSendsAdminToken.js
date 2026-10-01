const crypto = require('crypto');

const BEARER_PATTERN = /^Bearer[ \t]+(\S+)[ \t]*$/i;

// Hash both sides so timingSafeEqual always compares equal-length buffers and
// the comparison time doesn't depend on (or reveal) the token length.
const digest = (value) => crypto.createHash('sha256').update(value, 'utf8').digest();

const tokensMatch = (provided, expected) => crypto.timingSafeEqual(digest(provided), digest(expected));

/**
 * Protects the /api/v1/sends routes with `Authorization: Bearer <token>`,
 * matched against SENDS_ADMIN_TOKEN. Fails closed: when the variable is unset
 * or blank, every request gets 503 rather than open access.
 *
 * @param {{ getToken?: () => string|undefined }} [options] Reads the env var per request by default.
 */
const requireSendsAdminToken =
  ({ getToken = () => process.env.SENDS_ADMIN_TOKEN } = {}) =>
  (req, res, next) => {
    const expected = getToken();
    if (typeof expected !== 'string' || expected.trim() === '') {
      return res.status(503).json({ error: 'Sends admin API is not configured (SENDS_ADMIN_TOKEN is not set)' });
    }

    const match = BEARER_PATTERN.exec(req.get('authorization') || '');
    if (!match || !tokensMatch(match[1], expected)) {
      res.set('WWW-Authenticate', 'Bearer');
      return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
  };

module.exports = { requireSendsAdminToken };
