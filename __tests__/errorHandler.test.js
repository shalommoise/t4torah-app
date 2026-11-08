const express = require('express');
const request = require('supertest');
const { notFound, errorHandler } = require('../src/middleware/error');

const appThrowing = (makeError) => {
  const app = express();
  app.use(express.json());
  app.get('/boom', (req, res, next) => next(makeError()));
  app.post('/echo', (req, res) => res.json(req.body));
  app.use(notFound);
  app.use(errorHandler);
  return app;
};

describe('errorHandler', () => {
  let consoleError;

  beforeEach(() => {
    consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleError.mockRestore();
  });

  test('hides the message of an error with no status and logs it', async () => {
    const dbError = Object.assign(new Error("Access denied for user 'app'@'10.0.0.5' (using password: YES)"), {
      code: 'ER_ACCESS_DENIED_ERROR',
    });

    const res = await request(appThrowing(() => dbError)).get('/boom');

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Internal server error' });
    expect(res.text).not.toContain('Access denied');
    expect(consoleError).toHaveBeenCalledWith(dbError);
  });

  test.each([500, 502, 503])('hides the message of a %i error', async (status) => {
    const res = await request(appThrowing(() => Object.assign(new Error('chrome exited with code 1'), { status }))).get(
      '/boom'
    );

    expect(res.status).toBe(status);
    expect(res.body).toEqual({ error: 'Internal server error' });
  });

  test.each([400, 401, 404, 422])('keeps the message of a %i error', async (status) => {
    const res = await request(appThrowing(() => Object.assign(new Error('month must be 1-12'), { status }))).get(
      '/boom'
    );

    expect(res.status).toBe(status);
    expect(res.body).toEqual({ error: 'month must be 1-12' });
  });

  test.each([
    ['a status below 400', 302],
    ['a status above 599', 700],
    ['a non-numeric status', 'bad'],
  ])('treats %s as a 500', async (label, status) => {
    const res = await request(appThrowing(() => Object.assign(new Error('secret detail'), { status }))).get('/boom');

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Internal server error' });
  });

  test('handles a thrown non-Error value', async () => {
    const res = await request(appThrowing(() => 'plain string')).get('/boom');

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Internal server error' });
  });

  test('keeps the 400 from a malformed JSON body', async () => {
    const res = await request(appThrowing(() => new Error('unused')))
      .post('/echo')
      .set('Content-Type', 'application/json')
      .send('{"bad json"');

    expect(res.status).toBe(400);
    expect(res.body.error).not.toBe('Internal server error');
  });
});

describe('notFound', () => {
  test('returns a 404 body', async () => {
    const res = await request(appThrowing(() => new Error('unused'))).get('/missing');

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Not found' });
  });
});
