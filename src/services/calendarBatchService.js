const path = require('path');
const { selectTime4MishnaScheduleMonths } = require('../models/datesModel');
const { generateCalendarAssets } = require('./calendarService');
const { exportCalendarAssets } = require('./calendarExportService');

/** Header images, relative to calendar/generated/ where the HTML is written. */
const FILE_ASSET_BASE = '../../imgs';

/**
 * Generates and exports one month's calendar from the local HTML file (no server).
 * @param {{ month: number, year: number }} target
 */
const exportMonth = async ({ month, year }) => {
  const generated = await generateCalendarAssets({ month, year, assetBasePath: FILE_ASSET_BASE });
  return exportCalendarAssets({ month, year, htmlPath: generated.htmlPath });
};

/**
 * Exports the calendar for every month in the Time4Mishna schedule from
 * `fromDate` on (all of them when null). Keeps going past a failed month.
 *
 * @param {{ fromDate?: string|null, log?: Function, deps?: object }} options
 * @returns {Promise<{ exported: string[], failed: { month: string, error: string }[] }>}
 */
const exportScheduledCalendars = async ({ fromDate = null, log = () => {}, deps = {} } = {}) => {
  const listMonths = deps.listMonths || selectTime4MishnaScheduleMonths;
  const exportOne = deps.exportMonth || exportMonth;

  const months = await listMonths(fromDate);
  const exported = [];
  const failed = [];

  for (const target of months) {
    const label = `${target.year}-${String(target.month).padStart(2, '0')}`;
    try {
      const { pngPath } = await exportOne(target);
      exported.push(pngPath);
      log(`${label} → ${path.basename(pngPath)}`);
    } catch (error) {
      failed.push({ month: label, error: error.message });
      log(`${label} FAILED: ${error.message}`);
    }
  }

  return { exported, failed };
};

module.exports = { exportScheduledCalendars, exportMonth };
