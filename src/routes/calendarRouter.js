const express = require('express');
const { getCalendarMaker, getCalendarPage, exportCalendarPage } = require('../controllers/calendarController');

const calendarRouter = express.Router();

calendarRouter.get('/calendar/maker', getCalendarMaker);
calendarRouter.get('/calendar', getCalendarPage);
calendarRouter.get('/calendar/export', exportCalendarPage);

module.exports = calendarRouter;
