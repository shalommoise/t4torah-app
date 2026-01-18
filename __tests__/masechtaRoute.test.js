const request = require('supertest');
const app = require('../src/app');

describe('GET /api/sedarim/', () => {
  test('returns list of sedarim', async () => {
    const res = await request(app).get('/api/sedarim/');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    // Further checks can be added based on expected structure of sedarim
  });
}); 

describe('GET /api/masechtos/',()=>{
    test('returns list of masechtaos', async () => {
        const res = await request(app).get('/api/masechtos/');

        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
    });
});

describe('Get api/masechtos/:id',()=>{
    test.only('returns a specific masechta by ID', async () => {
        const res = await request(app).get('/api/masechtos/1'); // Assuming 1 is a valid ID
        //   console.log(res)
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('masechta_id', 1);
        // Further checks can be added based on expected structure of masechta
    })})