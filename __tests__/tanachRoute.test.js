const request = require('supertest');
const app = require('../src/app');
const { selectSefarim, selectSeferById } = require('../src/models/tanachModel');

jest.mock('../src/models/tanachModel', () => ({
  selectSefarim: jest.fn(),
  selectSeferById: jest.fn(),
}));

const API = '/api/v1/tanach';
const sefer = { sefer_id: 27, sefer_name: 'Tehillim', section: 'Kesuvim', sefer_chapter_count: 150 };

let consoleError;
beforeEach(() => {
  jest.clearAllMocks();
  consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => consoleError.mockRestore());

describe('GET /tanach', () => {
  test('returns sefarim with no filters', async () => {
    selectSefarim.mockResolvedValue([sefer]);
    const res = await request(app).get(API);
    expect(res.status).toBe(200);
    expect(res.body).toEqual([sefer]);
    expect(selectSefarim).toHaveBeenCalledWith({ section: undefined, subsection: undefined, seferName: undefined });
  });

  test('passes filters through', async () => {
    selectSefarim.mockResolvedValue([]);
    await request(app).get(`${API}?section=Nevi'im&subsection=Trei%20Asar&sefer_name=Yonah`);
    expect(selectSefarim).toHaveBeenCalledWith({ section: "Nevi'im", subsection: 'Trei Asar', seferName: 'Yonah' });
  });

  test('500 JSON when the model fails', async () => {
    selectSefarim.mockRejectedValue(new Error('connection lost'));
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

describe('GET /tanach/:seferId', () => {
  test('returns the sefer', async () => {
    selectSeferById.mockResolvedValue([sefer]);
    const res = await request(app).get(`${API}/27`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(sefer);
    expect(selectSeferById).toHaveBeenCalledWith('27');
  });

  test('400 for a non-numeric id', async () => {
    const res = await request(app).get(`${API}/tehillim`);
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'seferId must be a number' });
    expect(selectSeferById).not.toHaveBeenCalled();
  });

  test('405 for other methods', async () => {
    expect((await request(app).patch(`${API}/27`)).status).toBe(405);
  });
});
