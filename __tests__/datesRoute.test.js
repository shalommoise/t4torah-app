const request = require('supertest');
const app = require('../src/app');
const {
  selectDates,
  selectDateById,
  selectTime4MishnaScheduleByDateId,
  selectTime4NachScheduleByDateId,
} = require('../src/models/datesModel');

jest.mock('../src/models/datesModel', () => ({
  selectDates: jest.fn(),
  selectDateById: jest.fn(),
  selectTime4MishnaScheduleByDateId: jest.fn(),
  selectTime4NachScheduleByDateId: jest.fn(),
}));

const API = '/api/v1/dates';
const dateRow = { date_id: 10, gregorian_date: '2026-09-28', hebrew_date: '17 Tishrei 5787', day_of_week: 'Monday' };

let consoleError;
beforeEach(() => {
  jest.clearAllMocks();
  consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => consoleError.mockRestore());

describe('GET /dates', () => {
  test('returns dates with default pagination and no filters', async () => {
    selectDates.mockResolvedValue([dateRow]);

    const res = await request(app).get(API);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([dateRow]);
    expect(selectDates).toHaveBeenCalledWith(
      { gregorianDate: undefined, hebrewDate: undefined, isYomTov: null, specialDate: undefined },
      { limit: 50, offset: 0 }
    );
  });

  test('passes filters and pagination through', async () => {
    selectDates.mockResolvedValue([]);

    await request(app).get(
      `${API}?gregorian_date=2026-09-28&hebrew_date=17%20Tishrei%205787&special_date=Sukkos&limit=10&offset=20`
    );

    expect(selectDates).toHaveBeenCalledWith(
      { gregorianDate: '2026-09-28', hebrewDate: '17 Tishrei 5787', isYomTov: null, specialDate: 'Sukkos' },
      { limit: 10, offset: 20 }
    );
  });

  test.each([
    ['true', true],
    ['1', true],
    ['false', false],
    ['0', false],
  ])('is_yom_tov=%s → %p', async (value, expected) => {
    selectDates.mockResolvedValue([]);
    await request(app).get(`${API}?is_yom_tov=${value}`);
    expect(selectDates.mock.calls[0][0].isYomTov).toBe(expected);
  });

  test('caps limit at 500', async () => {
    selectDates.mockResolvedValue([]);
    await request(app).get(`${API}?limit=9999`);
    expect(selectDates.mock.calls[0][1]).toEqual({ limit: 500, offset: 0 });
  });

  test.each([
    ['is_yom_tov=yes', 'is_yom_tov must be a boolean'],
    ['limit=0', 'limit must be a positive integer'],
    ['limit=abc', 'limit must be a positive integer'],
    ['offset=-1', 'offset must be a non-negative integer'],
    ['offset=1.5', 'offset must be a non-negative integer'],
  ])('400 for %s', async (query, error) => {
    const res = await request(app).get(`${API}?${query}`);
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error });
    expect(selectDates).not.toHaveBeenCalled();
  });

  test('500 JSON when the model fails', async () => {
    selectDates.mockRejectedValue(new Error('connection lost'));
    const res = await request(app).get(API);
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'connection lost' });
  });

  test('405 for other methods', async () => {
    const res = await request(app).post(API);
    expect(res.status).toBe(405);
    expect(res.body).toEqual({ error: 'Method not allowed' });
  });
});

describe('GET /dates/:dateId', () => {
  test('returns the date', async () => {
    selectDateById.mockResolvedValue([dateRow]);
    const res = await request(app).get(`${API}/10`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(dateRow);
    expect(selectDateById).toHaveBeenCalledWith('10');
  });

  test('400 for a non-numeric id', async () => {
    const res = await request(app).get(`${API}/abc`);
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'dateId must be a number' });
    expect(selectDateById).not.toHaveBeenCalled();
  });

  test('405 for other methods', async () => {
    expect((await request(app).delete(`${API}/10`)).status).toBe(405);
  });
});

describe('GET /dates/:dateId/full', () => {
  test('returns the date with both schedules', async () => {
    const mishna = [{ daily_schedule_id: 1, shiur_title: 'Brachos 1:1-1:4' }];
    const nach = [{ daily_schedule_id: 2, shiur_title: 'Tehillim 42' }];
    selectDateById.mockResolvedValue([dateRow]);
    selectTime4MishnaScheduleByDateId.mockResolvedValue(mishna);
    selectTime4NachScheduleByDateId.mockResolvedValue(nach);

    const res = await request(app).get(`${API}/10/full`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ date: dateRow, time4mishna_schedule: mishna, time4nach_schedule: nach });
    expect(selectTime4MishnaScheduleByDateId).toHaveBeenCalledWith('10');
    expect(selectTime4NachScheduleByDateId).toHaveBeenCalledWith('10');
  });

  test('returns empty schedules on a no-shiur day', async () => {
    selectDateById.mockResolvedValue([dateRow]);
    selectTime4MishnaScheduleByDateId.mockResolvedValue([]);
    selectTime4NachScheduleByDateId.mockResolvedValue([]);
    const res = await request(app).get(`${API}/10/full`);
    expect(res.body).toEqual({ date: dateRow, time4mishna_schedule: [], time4nach_schedule: [] });
  });

  test('404 without loading schedules when the date does not exist', async () => {
    selectDateById.mockResolvedValue([]);
    const res = await request(app).get(`${API}/99999/full`);
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Date not found' });
    expect(selectTime4MishnaScheduleByDateId).not.toHaveBeenCalled();
    expect(selectTime4NachScheduleByDateId).not.toHaveBeenCalled();
  });

  test('400 for a non-numeric id', async () => {
    const res = await request(app).get(`${API}/abc/full`);
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'dateId must be a number' });
  });

  test('405 for other methods', async () => {
    expect((await request(app).put(`${API}/10/full`)).status).toBe(405);
  });
});
