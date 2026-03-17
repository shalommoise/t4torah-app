const path = require('path');
const { generateCalendarAssets, parseMonthYear } = require('../services/calendarService');
const { exportCalendarAssets } = require('../services/calendarExportService');
const { port } = require('../config/env');

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

const exportCalendarPage = async (req, res, next) => {
  try {
    const { monthNumber, yearNumber } = parseMonthYear(req.query);
    const format = req.query.format || 'all';

    if (!['pdf', 'png', 'all'].includes(format)) {
      return res.status(400).json({ error: 'format must be pdf, png, or all' });
    }

    await generateCalendarAssets({
      month: monthNumber,
      year: yearNumber,
      assetBasePath: '/imgs',
    });

    const result = await exportCalendarAssets({
      month: monthNumber,
      year: yearNumber,
      port,
    });

    if (format === 'pdf') {
      return res.download(result.pdfPath);
    }

    if (format === 'png') {
      return res.download(result.pngPath);
    }

    res.json({
      month: String(monthNumber).padStart(2, '0'),
      year: yearNumber,
      pdf: result.pdfPath,
      png: result.pngPath,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getCalendarMaker,
  getCalendarPage,
  exportCalendarPage,
};
