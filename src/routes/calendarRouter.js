const express = require('express');
const { requireSendsAdminToken } = require('../middleware/requireSendsAdminToken');
const { calendarPageCsp } = require('../middleware/security');
const { getCalendarMaker, getCalendarPage, exportCalendarPage } = require('../controllers/calendarController');

const passThrough = (req, res, next) => next();

/**
 * @param {{ limiter?: import('express').RequestHandler }} [options] Rate limiter for the calendar routes.
 */
const createCalendarRouter = ({ limiter = passThrough } = {}) => {
  const calendarRouter = express.Router();

  calendarRouter.get('/calendar/maker', getCalendarMaker);
  calendarRouter.get('/calendar', limiter, calendarPageCsp(), getCalendarPage);
  // Export launches headless Chrome and writes files, so it is admin-only.
  // The scheduled job (npm run calendars:export) does the same work without HTTP.
  calendarRouter.get('/calendar/export', limiter, requireSendsAdminToken(), exportCalendarPage);

  return calendarRouter;
};

module.exports = { createCalendarRouter };
