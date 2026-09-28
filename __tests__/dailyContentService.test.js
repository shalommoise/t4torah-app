const {
  selectDates,
  selectTime4MishnaScheduleByDateId,
  selectTime4NachScheduleByDateId,
} = require('../src/models/datesModel');
const { getDailyContent, isValidGregorianDate } = require('../src/services/dailyContentService');

jest.mock('../src/models/datesModel', () => ({
  selectDates: jest.fn(),
  selectTime4MishnaScheduleByDateId: jest.fn(),
  selectTime4NachScheduleByDateId: jest.fn(),
}));

describe('isValidGregorianDate', () => {
  test('accepts a real calendar date', () => {
    expect(isValidGregorianDate('2026-09-28')).toBe(true);
  });

  test('rejects a non-existent calendar date', () => {
    expect(isValidGregorianDate('2026-02-30')).toBe(false);
  });

  test('rejects malformed strings', () => {
    expect(isValidGregorianDate('28-09-2026')).toBe(false);
    expect(isValidGregorianDate('not-a-date')).toBe(false);
    expect(isValidGregorianDate(undefined)).toBe(false);
  });
});

describe('getDailyContent', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('throws a 400 error for an invalid date', async () => {
    await expect(getDailyContent('2026-13-01')).rejects.toMatchObject({
      status: 400,
      message: 'gregorianDate must be a valid date in YYYY-MM-DD format',
    });
    expect(selectDates).not.toHaveBeenCalled();
  });

  test('returns null when the date is not in dates_table', async () => {
    selectDates.mockResolvedValue([]);

    const result = await getDailyContent('2026-09-28');

    expect(result).toBeNull();
    expect(selectDates).toHaveBeenCalledWith(
      { gregorianDate: '2026-09-28', hebrewDate: undefined, isYomTov: null, specialDate: undefined },
      { limit: 1, offset: 0 }
    );
    expect(selectTime4MishnaScheduleByDateId).not.toHaveBeenCalled();
    expect(selectTime4NachScheduleByDateId).not.toHaveBeenCalled();
  });

  test('returns the date row plus both schedules when found', async () => {
    const dateRow = { date_id: 42, gregorian_date: '2026-09-28', day_of_week: 'Monday' };
    const mishnaSchedule = [{ daily_schedule_id: 1 }];
    const nachSchedule = [{ daily_schedule_id: 2 }];
    selectDates.mockResolvedValue([dateRow]);
    selectTime4MishnaScheduleByDateId.mockResolvedValue(mishnaSchedule);
    selectTime4NachScheduleByDateId.mockResolvedValue(nachSchedule);

    const result = await getDailyContent('2026-09-28');

    expect(result).toEqual({
      date: dateRow,
      time4mishna: mishnaSchedule,
      time4nach: nachSchedule,
    });
    expect(selectTime4MishnaScheduleByDateId).toHaveBeenCalledWith(42);
    expect(selectTime4NachScheduleByDateId).toHaveBeenCalledWith(42);
  });
});
