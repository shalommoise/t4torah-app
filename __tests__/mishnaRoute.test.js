const request = require('supertest');
const app = require('../src/app');
const { selectMishnaById } = require('../src/models/mishnaModel');

const API_BASE = '/api/v1';

jest.mock('../src/models/mishnaModel', () => ({
  selectMishnaById: jest.fn(),
}));

describe('GET /api/v1/mishnas/:mishnaId', () => {
  test('returns data for a known id', async () => {
    const mockRow = { mishna_id: 1, text: 'Test Mishna' };
    selectMishnaById.mockResolvedValue([mockRow]);

    const res = await request(app).get(`${API_BASE}/mishnas/1`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([mockRow]);
    expect(selectMishnaById).toHaveBeenCalledWith('1');
  });

  test('returns 404 when id does not exist', async () => {
    selectMishnaById.mockResolvedValue([]);

    const res = await request(app).get(`${API_BASE}/mishnas/99999`);

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Mishna not found' });
  });
  test('returns empty array when id is wrong format', async () => {
    selectMishnaById.mockResolvedValue([]);

    const res = await request(app).get(`${API_BASE}/mishnas/ansfjensfkjnkfn`);

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'mishnaId must be a number' });
  });
  test('POST mishnaId should not be allowed', async () => {
    selectMishnaById.mockResolvedValue([]);

    const res = await request(app).post(`${API_BASE}/mishnas/`);

    expect(res.status).toBe(405);
    expect(res.body).toEqual({ error: 'Method not allowed' });
  });
});
