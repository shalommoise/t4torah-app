const request = require('supertest');
const app = require('../src/app');
const { selectMaschechtaById } = require('../src/models/masechtaModel');
const { selectDateById } = require('../src/models/datesModel');
const { selectSeferById } = require('../src/models/tanachModel');
const {
  selectTime4MishnaShiurById,
  selectTime4MishnaScheduleById,
} = require('../src/models/time4mishnaModel');
const {
  selectTime4NachShiurById,
  selectTime4NachScheduleById,
} = require('../src/models/time4nachModel');

const API_BASE = '/api/v1';

jest.mock('../src/models/masechtaModel', () => ({
  selectMasechtos: jest.fn(),
  selectMaschechtaById: jest.fn(),
}));

jest.mock('../src/models/datesModel', () => ({
  selectDates: jest.fn(),
  selectDateById: jest.fn(),
  selectTime4MishnaScheduleByDateId: jest.fn(),
  selectTime4NachScheduleByDateId: jest.fn(),
}));

jest.mock('../src/models/tanachModel', () => ({
  selectSefarim: jest.fn(),
  selectSeferById: jest.fn(),
}));

jest.mock('../src/models/time4mishnaModel', () => ({
  selectTime4MishnaShiurim: jest.fn(),
  selectTime4MishnaShiurById: jest.fn(),
  selectTime4MishnaSchedule: jest.fn(),
  selectTime4MishnaScheduleById: jest.fn(),
}));

jest.mock('../src/models/time4nachModel', () => ({
  selectTime4NachShiurim: jest.fn(),
  selectTime4NachShiurById: jest.fn(),
  selectTime4NachSchedule: jest.fn(),
  selectTime4NachScheduleById: jest.fn(),
}));

describe('GET-by-ID not found responses', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test.each([
    {
      endpoint: `${API_BASE}/masechtos/99999`,
      selectById: selectMaschechtaById,
      error: 'Masechta not found',
    },
    {
      endpoint: `${API_BASE}/dates/99999`,
      selectById: selectDateById,
      error: 'Date not found',
    },
    {
      endpoint: `${API_BASE}/tanach/99999`,
      selectById: selectSeferById,
      error: 'Sefer not found',
    },
    {
      endpoint: `${API_BASE}/time4mishna/shiurim/99999`,
      selectById: selectTime4MishnaShiurById,
      error: 'Shiur not found',
    },
    {
      endpoint: `${API_BASE}/time4mishna/schedule/99999`,
      selectById: selectTime4MishnaScheduleById,
      error: 'Schedule entry not found',
    },
    {
      endpoint: `${API_BASE}/time4nach/shiurim/99999`,
      selectById: selectTime4NachShiurById,
      error: 'Shiur not found',
    },
    {
      endpoint: `${API_BASE}/time4nach/schedule/99999`,
      selectById: selectTime4NachScheduleById,
      error: 'Schedule entry not found',
    },
  ])('$endpoint returns 404 when the record does not exist', async ({ endpoint, selectById, error }) => {
    selectById.mockResolvedValue([]);

    const res = await request(app).get(endpoint);

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error });
  });
});
