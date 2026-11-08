const helmet = require('helmet');
const { rateLimit } = require('express-rate-limit');

/**
 * Helmet's defaults, except Cross-Origin-Resource-Policy: the public website
 * on another origin embeds /imgs and the exported calendars.
 */
const securityHeaders = () => helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } });

/**
 * The calendar page renders its data with an inline <script> and <style>
 * (calendar/template.html), so its CSP allows inline scripts. Every other
 * response keeps helmet's default CSP, which blocks them.
 */
const calendarPageCsp = () =>
  helmet.contentSecurityPolicy({
    useDefaults: true,
    directives: { 'script-src': ["'self'", "'unsafe-inline'"] },
  });

const tooManyRequests = (req, res) => {
  res.status(429).json({ error: 'Too many requests, try again later' });
};

/**
 * Per-client request limit. Sends RateLimit-* headers and a JSON 429.
 * @param {{ windowMs: number, limit: number }} options
 */
const createRateLimiter = ({ windowMs, limit }) =>
  rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler: tooManyRequests,
  });

module.exports = { securityHeaders, calendarPageCsp, createRateLimiter };
