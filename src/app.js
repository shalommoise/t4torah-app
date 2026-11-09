const express = require('express');
const path = require('path');
const routes = require('./routes');
const { createCalendarRouter } = require('./routes/calendarRouter');
const { notFound, errorHandler } = require('./middleware/error');
const { serveStaticAllowlist } = require('./middleware/staticAllowlist');
const { securityHeaders, createRateLimiter } = require('./middleware/security');
const { getHttpConfig } = require('./config/http');
const cors = require("cors");

const httpConfig = getHttpConfig();
const app = express();
app.set('trust proxy', httpConfig.trustProxy);
app.disable('x-powered-by');
app.use(securityHeaders());
app.use(createRateLimiter({ windowMs: httpConfig.windowMs, limit: httpConfig.max }));
app.use(cors());
app.use(express.json());
app.use('/imgs', serveStaticAllowlist(path.join(process.cwd(), 'imgs'), ['.png', '.svg']));
// Only the exported calendars are public; templates, data JSON and generated HTML are not.
app.use(
  '/calendar-files/generated',
  serveStaticAllowlist(path.join(process.cwd(), 'calendar', 'generated'), ['.pdf', '.png'])
);
// /calendar writes files and queries the DB on every request, so it gets a tighter limit.
app.use(
  createCalendarRouter({
    limiter: createRateLimiter({ windowMs: httpConfig.windowMs, limit: httpConfig.calendarMax }),
  })
);
app.use('/api/v1', routes);
app.use(notFound);
app.use(errorHandler);

module.exports = app;
