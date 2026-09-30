// utils/findFile.js reads BUCKET_PATH when it is first required, and dotenv
// never overrides a variable that is already set, so this fixes the value the
// shiur links are built from (independent of any local .env).
const originalBucketPath = process.env.BUCKET_PATH;
process.env.BUCKET_PATH = 'https://bucket.test';

const request = require('supertest');
const app = require('../src/app');
const {
  selectTime4MishnaShiurim,
  selectTime4MishnaShiurById,
  selectTime4MishnaSchedule,
  selectTime4MishnaScheduleById,
} = require('../src/models/time4mishnaModel');

jest.mock('../src/models/time4mishnaModel', () => ({
  selectTime4MishnaShiurim: jest.fn(),
  selectTime4MishnaShiurById: jest.fn(),
  selectTime4MishnaSchedule: jest.fn(),
  selectTime4MishnaScheduleById: jest.fn(),
}));

const API = '/api/v1/time4mishna';

let consoleError;
beforeEach(() => {
  jest.clearAllMocks();
  consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => consoleError.mockRestore());
afterAll(() => {
  if (originalBucketPath === undefined) {
    delete process.env.BUCKET_PATH;
  } else {
    process.env.BUCKET_PATH = originalBucketPath;
  }
});

describe('GET /time4mishna/shiurim', () => {
  test('returns shiurim with no filters', async () => {
    const shiurim = [{ time4mishna_shiur_id: 1, shiur_title: 'Brachos 1:1-1:4' }];
    selectTime4MishnaShiurim.mockResolvedValue(shiurim);

    const res = await request(app).get(`${API}/shiurim`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual(shiurim);
    expect(selectTime4MishnaShiurim).toHaveBeenCalledWith({ startMishna: null, endMishna: null, shiurTitle: undefined });
  });

  test('parses numeric filters', async () => {
    selectTime4MishnaShiurim.mockResolvedValue([]);
    await request(app).get(`${API}/shiurim?start_mishna=5&end_mishna=9&shiur_title=Brachos`);
    expect(selectTime4MishnaShiurim).toHaveBeenCalledWith({ startMishna: 5, endMishna: 9, shiurTitle: 'Brachos' });
  });

  test.each([
    ['start_mishna=abc', 'start_mishna must be a number'],
    ['end_mishna=1.5', 'end_mishna must be a number'],
  ])('400 for %s', async (query, error) => {
    const res = await request(app).get(`${API}/shiurim?${query}`);
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error });
    expect(selectTime4MishnaShiurim).not.toHaveBeenCalled();
  });

  test('405 for other methods', async () => {
    const res = await request(app).post(`${API}/shiurim`);
    expect(res.status).toBe(405);
    expect(res.body).toEqual({ error: 'Method not allowed' });
  });
});

describe('GET /time4mishna/shiurim/:shiurId', () => {
  test('returns the shiur with audio and text links', async () => {
    selectTime4MishnaShiurById.mockResolvedValue([{ time4mishna_shiur_id: 1, shiur_title: 'Brachos 1:1-1:4' }]);

    const res = await request(app).get(`${API}/shiurim/1`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      time4mishna_shiur_id: 1,
      shiur_title: 'Brachos 1:1-1:4',
      shiur_link: 'https://bucket.test/mishna/shiurim/brachos_1:1-1:4.mp3',
      shiur_text_link: 'https://bucket.test/mishna/shiurim/brachos_1:1-1:4.pdf',
      text_link: 'https://bucket.test/mishna/texts/brachos_1:1-1:4.pdf',
    });
    expect(selectTime4MishnaShiurById).toHaveBeenCalledWith('1');
  });

  test('400 for a non-numeric id', async () => {
    const res = await request(app).get(`${API}/shiurim/brachos`);
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'shiurId must be a number' });
    expect(selectTime4MishnaShiurById).not.toHaveBeenCalled();
  });

  test('500 JSON when the model fails', async () => {
    selectTime4MishnaShiurById.mockRejectedValue(new Error('connection lost'));
    const res = await request(app).get(`${API}/shiurim/1`);
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'connection lost' });
  });
});

describe('GET /time4mishna/schedule', () => {
  test('returns the schedule with default pagination', async () => {
    const schedule = [{ daily_schedule_id: 7, date_id: 10 }];
    selectTime4MishnaSchedule.mockResolvedValue(schedule);

    const res = await request(app).get(`${API}/schedule`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual(schedule);
    expect(selectTime4MishnaSchedule).toHaveBeenCalledWith({ dateId: null }, { limit: 50, offset: 0 });
  });

  test('parses date_id and caps limit at 200', async () => {
    selectTime4MishnaSchedule.mockResolvedValue([]);
    await request(app).get(`${API}/schedule?date_id=10&limit=1000&offset=5`);
    expect(selectTime4MishnaSchedule).toHaveBeenCalledWith({ dateId: 10 }, { limit: 200, offset: 5 });
  });

  test.each([
    ['date_id=today', 'date_id must be a number'],
    ['limit=-5', 'limit must be a positive integer'],
    ['offset=x', 'offset must be a non-negative integer'],
  ])('400 for %s', async (query, error) => {
    const res = await request(app).get(`${API}/schedule?${query}`);
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error });
    expect(selectTime4MishnaSchedule).not.toHaveBeenCalled();
  });
});

describe('GET /time4mishna/schedule/:dailyScheduleId', () => {
  test('returns the schedule entry', async () => {
    selectTime4MishnaScheduleById.mockResolvedValue([{ daily_schedule_id: 7 }]);
    const res = await request(app).get(`${API}/schedule/7`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ daily_schedule_id: 7 });
    expect(selectTime4MishnaScheduleById).toHaveBeenCalledWith('7');
  });

  test('400 for a non-numeric id', async () => {
    const res = await request(app).get(`${API}/schedule/x`);
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'dailyScheduleId must be a number' });
  });

  test('405 for other methods', async () => {
    expect((await request(app).delete(`${API}/schedule/7`)).status).toBe(405);
  });
});
