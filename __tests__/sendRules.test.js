const { shouldSendOn, getCalendarRowProblem, SEND_WEEKDAYS } = require('../src/services/sendRules');

describe('shouldSendOn', () => {
  test('sends on a regular weekday', () => {
    expect(shouldSendOn({ day_of_week: 'Monday', is_yom_tov: false })).toBe(true);
  });

  test('sends on Friday', () => {
    expect(shouldSendOn({ day_of_week: 'Friday', is_yom_tov: false })).toBe(true);
  });

  test('does not send on Shabbos', () => {
    expect(shouldSendOn({ day_of_week: 'Shabbos', is_yom_tov: false })).toBe(false);
  });

  test('does not send on Yom Tov', () => {
    expect(shouldSendOn({ day_of_week: 'Tuesday', is_yom_tov: true })).toBe(false);
  });

  test('does not send on Yom Tov represented as a MySQL tinyint(1)', () => {
    expect(shouldSendOn({ day_of_week: 'Tuesday', is_yom_tov: 1 })).toBe(false);
  });

  test('sends on Chol HaMoed (not Shabbos, not flagged as Yom Tov)', () => {
    expect(shouldSendOn({ day_of_week: 'Wednesday', is_yom_tov: false, special_date: 'Chol HaMoed Succos' })).toBe(
      true
    );
  });

  test('does not send when there is no date row', () => {
    expect(shouldSendOn(null)).toBe(false);
    expect(shouldSendOn(undefined)).toBe(false);
  });
});

describe('shouldSendOn fails closed (G1)', () => {
  test.each(SEND_WEEKDAYS)('sends on %s with is_yom_tov 0', (day) => {
    expect(shouldSendOn({ day_of_week: day, is_yom_tov: 0 })).toBe(true);
  });

  test.each([
    ['day_of_week null', { day_of_week: null, is_yom_tov: 0 }],
    ['day_of_week missing', { is_yom_tov: 0 }],
    ['day_of_week unknown', { day_of_week: 'Saturday', is_yom_tov: 0 }],
    ['day_of_week lower case', { day_of_week: 'monday', is_yom_tov: 0 }],
    ['day_of_week empty', { day_of_week: '', is_yom_tov: 0 }],
    ['is_yom_tov null', { day_of_week: 'Monday', is_yom_tov: null }],
    ['is_yom_tov missing', { day_of_week: 'Monday' }],
    ['is_yom_tov string "0"', { day_of_week: 'Monday', is_yom_tov: '0' }],
    ['is_yom_tov 2', { day_of_week: 'Monday', is_yom_tov: 2 }],
    ['both null', { day_of_week: null, is_yom_tov: null }],
  ])('does not send when %s', (_name, row) => {
    expect(shouldSendOn(row)).toBe(false);
  });
});

describe('getCalendarRowProblem', () => {
  test.each([
    [{ day_of_week: 'Monday', is_yom_tov: 0 }],
    [{ day_of_week: 'Friday', is_yom_tov: false }],
    [{ day_of_week: 'Shabbos', is_yom_tov: 0 }],
    [{ day_of_week: 'Tuesday', is_yom_tov: 1 }],
    [{ day_of_week: 'Shabbos', is_yom_tov: true }],
  ])('accepts a recognised row %p', (row) => {
    expect(getCalendarRowProblem(row)).toBeNull();
  });

  test.each([
    [null, 'missing date row'],
    [undefined, 'missing date row'],
    [{ day_of_week: null, is_yom_tov: 0 }, 'unrecognised day_of_week: null'],
    [{ is_yom_tov: 0 }, 'unrecognised day_of_week: null'],
    [{ day_of_week: 'Saturday', is_yom_tov: 0 }, 'unrecognised day_of_week: "Saturday"'],
    [{ day_of_week: 'Monday', is_yom_tov: null }, 'unrecognised is_yom_tov: null'],
    [{ day_of_week: 'Monday' }, 'unrecognised is_yom_tov: null'],
    [{ day_of_week: 'Monday', is_yom_tov: '1' }, 'unrecognised is_yom_tov: "1"'],
  ])('describes the problem with %p', (row, problem) => {
    expect(getCalendarRowProblem(row)).toBe(problem);
  });
});
