const { query } = require('../src/config/env');
const { selectTime4MishnaScheduleMonths } = require('../src/models/datesModel');

jest.mock('../src/config/env', () => ({ query: jest.fn() }));

beforeEach(() => jest.clearAllMocks());

describe('selectTime4MishnaScheduleMonths', () => {
  test('lists scheduled months from fromDate with a placeholder', async () => {
    query.mockResolvedValue([[{ year: 2026, month: 11 }, { year: '2027', month: '1' }]]);

    await expect(selectTime4MishnaScheduleMonths('2026-11-01')).resolves.toEqual([
      { year: 2026, month: 11 },
      { year: 2027, month: 1 },
    ]);
    const [sql, params] = query.mock.calls[0];
    expect(sql).toMatch(/FROM time4mishna_daily_schedule/);
    expect(sql).toMatch(/WHERE d\.gregorian_date >= \?/);
    expect(sql).toMatch(/ORDER BY year, month/);
    expect(params).toEqual(['2026-11-01']);
  });

  test('without fromDate, lists every scheduled month', async () => {
    query.mockResolvedValue([[]]);

    await expect(selectTime4MishnaScheduleMonths()).resolves.toEqual([]);
    const [sql, params] = query.mock.calls[0];
    expect(sql).not.toMatch(/WHERE/);
    expect(params).toEqual([]);
  });
});
