const request = require('supertest');
const app = require('../src/app');
const { selectMishnaById } = require('../src/models/mishnaModel');

jest.mock('../src/models/mishnaModel', () => ({
  selectMishnaById: jest.fn(),
}));

describe('GET /api/mishna/:mishnaId', () => {
  test('returns data for a known id', async () => {
    const mockRow = { mishna_id: 1, text: 'Test Mishna' };
    selectMishnaById.mockResolvedValue([mockRow]);

    const res = await request(app).get('/api/mishna/1');

    expect(res.status).toBe(200);
    expect(res.body).toEqual([mockRow]);
    expect(selectMishnaById).toHaveBeenCalledWith('1');
  });

  test('returns empty array when id is missing', async () => {
    selectMishnaById.mockResolvedValue([]);

    const res = await request(app).get('/api/mishna/99999');

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});
