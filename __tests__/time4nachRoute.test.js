const request = require('supertest');
const app = require('../src/app');
const {
  selectTime4NachShiurim,
  selectTime4NachShiurById,
  selectTime4NachSchedule,
  selectTime4NachScheduleById,
} = require('../src/models/time4nachModel');

jest.mock('../src/models/time4nachModel', () => ({
  selectTime4NachShiurim: jest.fn(),
  selectTime4NachShiurById: jest.fn(),
  selectTime4NachSchedule: jest.fn(),
  selectTime4NachScheduleById: jest.fn(),
}));

const API = '/api/v1/time4nach';

let consoleError;
beforeEach(() => {
  jest.clearAllMocks();
  consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => consoleError.mockRestore());

describe('GET /time4nach/shiurim', () => {
  test('returns shiurim with no filters', async () => {
    const shiurim = [{ time4nach_shiur_id: 3, shiur_title: 'Tehillim 42' }];
    selectTime4NachShiurim.mockResolvedValue(shiurim);

    const res = await request(app).get(`${API}/shiurim`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual(shiurim);
    expect(selectTime4NachShiurim).toHaveBeenCalledWith({ seferId: null, perek: null, shiurTitle: undefined });
  });

  test('parses numeric filters', async () => {
    selectTime4NachShiurim.mockResolvedValue([]);
    await request(app).get(`${API}/shiurim?sefer_id=27&perek=42&shiur_title=Tehillim`);
    expect(selectTime4NachShiurim).toHaveBeenCalledWith({ seferId: 27, perek: 42, shiurTitle: 'Tehillim' });
  });

  test.each([
    ['sefer_id=tehillim', 'sefer_id must be a number'],
    ['perek=4.2', 'perek must be a number'],
  ])('400 for %s', async (query, error) => {
    const res = await request(app).get(`${API}/shiurim?${query}`);
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error });
    expect(selectTime4NachShiurim).not.toHaveBeenCalled();
  });

  test('405 for other methods', async () => {
    const res = await request(app).put(`${API}/shiurim`);
    expect(res.status).toBe(405);
    expect(res.body).toEqual({ error: 'Method not allowed' });
  });
});

describe('GET /time4nach/shiurim/:shiurId', () => {
  test('returns the shiur', async () => {
    selectTime4NachShiurById.mockResolvedValue([{ time4nach_shiur_id: 3, shiur_title: 'Tehillim 42' }]);
    const res = await request(app).get(`${API}/shiurim/3`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ time4nach_shiur_id: 3, shiur_title: 'Tehillim 42' });
    expect(selectTime4NachShiurById).toHaveBeenCalledWith('3');
  });

  test('400 for a non-numeric id', async () => {
    const res = await request(app).get(`${API}/shiurim/x`);
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'shiurId must be a number' });
    expect(selectTime4NachShiurById).not.toHaveBeenCalled();
  });
});

describe('GET /time4nach/schedule', () => {
  test('returns the schedule with default pagination', async () => {
    const schedule = [{ daily_schedule_id: 9, date_id: 10 }];
    selectTime4NachSchedule.mockResolvedValue(schedule);

    const res = await request(app).get(`${API}/schedule`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual(schedule);
    expect(selectTime4NachSchedule).toHaveBeenCalledWith({ dateId: null }, { limit: 50, offset: 0 });
  });

  test('parses date_id and caps limit at 200', async () => {
    selectTime4NachSchedule.mockResolvedValue([]);
    await request(app).get(`${API}/schedule?date_id=10&limit=201`);
    expect(selectTime4NachSchedule).toHaveBeenCalledWith({ dateId: 10 }, { limit: 200, offset: 0 });
  });

  test.each([
    ['date_id=abc', 'date_id must be a number'],
    ['limit=0', 'limit must be a positive integer'],
    ['offset=-2', 'offset must be a non-negative integer'],
  ])('400 for %s', async (query, error) => {
    const res = await request(app).get(`${API}/schedule?${query}`);
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error });
    expect(selectTime4NachSchedule).not.toHaveBeenCalled();
  });

  test('500 JSON when the model fails', async () => {
    selectTime4NachSchedule.mockRejectedValue(new Error('connection lost'));
    const res = await request(app).get(`${API}/schedule`);
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'connection lost' });
  });
});

describe('GET /time4nach/schedule/:dailyScheduleId', () => {
  test('returns the schedule entry', async () => {
    selectTime4NachScheduleById.mockResolvedValue([{ daily_schedule_id: 9 }]);
    const res = await request(app).get(`${API}/schedule/9`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ daily_schedule_id: 9 });
    expect(selectTime4NachScheduleById).toHaveBeenCalledWith('9');
  });

  test('400 for a non-numeric id', async () => {
    const res = await request(app).get(`${API}/schedule/x`);
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'dailyScheduleId must be a number' });
  });

  test('405 for other methods', async () => {
    expect((await request(app).post(`${API}/schedule/9`)).status).toBe(405);
  });
});
