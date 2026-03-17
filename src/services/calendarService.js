const fs = require('fs/promises');
const path = require('path');
const { query } = require('../config/env');
const { selectTime4MishnaScheduleByDateId } = require('../models/datesModel');

const CALENDAR_DIR = path.join(process.cwd(), 'calendar');
const DATA_DIR = path.join(CALENDAR_DIR, 'data');
const GENERATED_DIR = path.join(CALENDAR_DIR, 'generated');
const TEMPLATE_PATH = path.join(CALENDAR_DIR, 'template.html');

const parseMonthYear = ({ month, year }) => {
  const parsedMonth = Number(month);
  const parsedYear = Number(year);

  if (
    !Number.isInteger(parsedMonth) ||
    parsedMonth < 1 ||
    parsedMonth > 12 ||
    !Number.isInteger(parsedYear) ||
    parsedYear < 1
  ) {
    const error = new Error('month must be 1-12 and year must be a positive number');
    error.status = 400;
    throw error;
  }

  return {
    monthNumber: parsedMonth,
    yearNumber: parsedYear,
    monthPadded: String(parsedMonth).padStart(2, '0'),
  };
};

const getMonthDateRange = ({ monthNumber, yearNumber }) => {
  const monthPadded = String(monthNumber).padStart(2, '0');
  const startDate = `${yearNumber}-${monthPadded}-01`;
  const lastDay = new Date(yearNumber, monthNumber, 0).getDate();
  const endDate = `${yearNumber}-${monthPadded}-${String(lastDay).padStart(2, '0')}`;

  return { startDate, endDate };
};

const selectDatesForMonth = async ({ monthNumber, yearNumber }) => {
  const { startDate, endDate } = getMonthDateRange({ monthNumber, yearNumber });
  const [rows] = await query(
    `SELECT *
     FROM dates_table
     WHERE gregorian_date BETWEEN ? AND ?
     ORDER BY gregorian_date ASC`,
    [startDate, endDate]
  );
  return rows;
};

const normalizeShiur = (scheduleRow) => {
  if (!scheduleRow) {
    return {
      shiur_type: null,
      shiur_title: null,
      additional_notice: null,
    };
  }

  if (scheduleRow.shiur_type === 'regular') {
    return {
      shiur_type: 'regular',
      shiur_title: scheduleRow.shiur_title,
      additional_notice: scheduleRow.additional_notice,
    };
  }

  return {
    shiur_type: 'chazara',
    shiur_title: 'Chazara',
    additional_notice: scheduleRow.additional_notice,
  };
};

const buildCalendarJson = async ({ month, year }) => {
  const parsed = parseMonthYear({ month, year });
  const monthDates = await selectDatesForMonth(parsed);

  const normalizedDays = await Promise.all(
    monthDates.map(async (dateRow) => {
      const schedules = await selectTime4MishnaScheduleByDateId(dateRow.date_id);
      const primarySchedule = schedules[0] || null;
      const normalizedShiur = normalizeShiur(primarySchedule);

      return {
        date_id: dateRow.date_id,
        gregorian_date: dateRow.gregorian_date,
        hebrew_date: dateRow.hebrew_date,
        hebrew_date_he: dateRow.hebrew_date_he,
        day_of_week: dateRow.day_of_week,
        is_yom_tov: dateRow.is_yom_tov,
        special_date: dateRow.special_date,
        shiur_type: normalizedShiur.shiur_type,
        shiur_title: normalizedShiur.shiur_title,
        additional_notice: normalizedShiur.additional_notice,
      };
    })
  );

  return {
    ...parsed,
    data: normalizedDays,
  };
};

const renderCalendarHtml = async ({ data, assetBasePath = '/calendar-files' }) => {
  const template = await fs.readFile(TEMPLATE_PATH, 'utf8');

  return template
    .replace(/__CALENDAR_DATA__/g, JSON.stringify(data))
    .replace(/__CALENDAR_ASSET_BASE__/g, assetBasePath);
};

const writeCalendarAssets = async ({ monthPadded, yearNumber, data, html }) => {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.mkdir(GENERATED_DIR, { recursive: true });

  const jsonPath = path.join(DATA_DIR, `calendar_${monthPadded}_${yearNumber}.json`);
  const htmlPath = path.join(GENERATED_DIR, `calendar_${monthPadded}_${yearNumber}.html`);

  await fs.writeFile(jsonPath, JSON.stringify(data, null, 2));
  await fs.writeFile(htmlPath, html);

  return { jsonPath, htmlPath };
};

const generateCalendarAssets = async ({ month, year, assetBasePath } = {}) => {
  const { monthPadded, yearNumber, data } = await buildCalendarJson({ month, year });
  const html = await renderCalendarHtml({ data, assetBasePath });
  const files = await writeCalendarAssets({ monthPadded, yearNumber, data, html });

  return {
    month: monthPadded,
    year: yearNumber,
    data,
    html,
    ...files,
  };
};

module.exports = {
  buildCalendarJson,
  generateCalendarAssets,
  parseMonthYear,
};
