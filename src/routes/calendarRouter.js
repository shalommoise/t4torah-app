const express = require('express');
const { requireSendsAdminToken } = require('../middleware/requireSendsAdminToken');
const { getCalendarMaker, getCalendarPage, exportCalendarPage } = require('../controllers/calendarController');

const calendarRouter = express.Router();

calendarRouter.get('/calendar/maker', getCalendarMaker);
calendarRouter.get('/calendar', getCalendarPage);
// Export launches headless Chrome and writes files, so it is admin-only.
// The scheduled job (npm run calendars:export) does the same work without HTTP.
calendarRouter.get('/calendar/export', requireSendsAdminToken(), exportCalendarPage);

module.exports = calendarRouter;
