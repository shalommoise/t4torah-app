const express = require('express');
const { getCalendarMaker, getCalendarPage } = require('../controllers/calendarController');

const calendarRouter = express.Router();

calendarRouter.get('/calendar/maker', getCalendarMaker);
calendarRouter.get('/calendar', getCalendarPage);

module.exports = calendarRouter;
