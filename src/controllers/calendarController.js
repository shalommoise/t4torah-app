const path = require('path');
const { generateCalendarAssets, parseMonthYear } = require('../services/calendarService');

const calendarMakerPath = path.join(process.cwd(), 'calendar', 'maker.html');

const getCalendarMaker = (req, res) => {
  res.sendFile(calendarMakerPath);
};

const getCalendarPage = async (req, res, next) => {
  try {
    const { monthNumber, yearNumber } = parseMonthYear(req.query);
    const result = await generateCalendarAssets({
      month: monthNumber,
      year: yearNumber,
      assetBasePath: '/imgs',
    });

    res.type('html').send(result.html);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getCalendarMaker,
  getCalendarPage,
};
