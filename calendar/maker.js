const { generateCalendarAssets, parseMonthYear } = require('../src/services/calendarService');

const parseCliArgs = () => {
  const [, , monthArg, yearArg] = process.argv;
  const now = new Date();

  try {
    return parseMonthYear({
      month: Number(monthArg ?? now.getMonth() + 1),
      year: Number(yearArg ?? now.getFullYear()),
    });
  } catch (error) {
    console.error('Usage: node calendar/maker.js <month 1-12> <year>');
    process.exit(1);
  }
};

const generateCalendarData = async ({ monthPadded, yearNumber }) => {
  const result = await generateCalendarAssets({
    month: monthPadded,
    year: yearNumber,
    assetBasePath: '/imgs',
  });

  console.log(`Calendar JSON saved to ${result.jsonPath}`);
  console.log(`Calendar HTML saved to ${result.htmlPath}`);
};

const { monthPadded, yearNumber } = parseCliArgs();
generateCalendarData({ monthPadded, yearNumber }).catch((error) => {
  console.error('Failed to generate calendar assets:', error);
  process.exit(1);
});
