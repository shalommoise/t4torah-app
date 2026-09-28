const request = require('supertest');
const app = require('../../src/app');
const { pool } = require('../../src/config/env');

afterAll(async () => {
  await pool.end();
});

describe('GET /api/v1/sedarim/', () => {
  test('returns list of sedarim', async () => {
    const res = await request(app).get('/api/v1/sedarim/');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    // Further checks can be added based on expected structure of sedarim
  });
}); 

describe('GET /api/v1/masechtos/',()=>{
    test('returns list of masechtaos', async () => {
        const res = await request(app).get('/api/v1/masechtos/');

        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
    });
});

describe('GET /api/v1/masechtos/:id',()=>{
    test('returns a specific masechta by ID', async () => {
        const res = await request(app).get('/api/v1/masechtos/1'); // Assuming 1 is a valid ID
        //   console.log(res)
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('masechta_id', 1);
        // Further checks can be added based on expected structure of masechta
    })})
