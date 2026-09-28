const { shouldSendOn } = require('../src/services/sendRules');

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
