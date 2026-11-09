const fs = require('fs');
const path = require('path');
const request = require('supertest');
const app = require('../src/app');

const GENERATED_DIR = path.join(process.cwd(), 'calendar', 'generated');
const FIXTURES = {
  png: path.join(GENERATED_DIR, 'T4M-99-test.png'),
  pdf: path.join(GENERATED_DIR, 'calendar_99_test.pdf'),
  html: path.join(GENERATED_DIR, 'calendar_99_test.html'),
  dotfile: path.join(GENERATED_DIR, '.secret_test.png'),
};

beforeAll(() => {
  fs.mkdirSync(GENERATED_DIR, { recursive: true });
  fs.writeFileSync(FIXTURES.png, 'png');
  fs.writeFileSync(FIXTURES.pdf, 'pdf');
  fs.writeFileSync(FIXTURES.html, '<html></html>');
  fs.writeFileSync(FIXTURES.dotfile, 'hidden');
});

afterAll(() => {
  Object.values(FIXTURES).forEach((file) => fs.rmSync(file, { force: true }));
});

describe('GET /calendar-files', () => {
  test.each([
    ['the template', '/calendar-files/template.html'],
    ['the template copy', '/calendar-files/template%20copy.html'],
    ['the maker page source', '/calendar-files/maker.js'],
    ['a data JSON file', '/calendar-files/data/calendar_01_2027.json'],
    ['a generated HTML file', '/calendar-files/generated/calendar_99_test.html'],
    ['a dotfile', '/calendar-files/generated/.secret_test.png'],
    ['the generated folder itself', '/calendar-files/generated/'],
    ['a path traversal', '/calendar-files/generated/..%2Ftemplate.html'],
  ])('returns 404 for %s', async (label, url) => {
    const res = await request(app).get(url);

    expect(res.status).toBe(404);
  });

  test('serves a generated PNG', async () => {
    const res = await request(app).get('/calendar-files/generated/T4M-99-test.png');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('image/png');
  });

  test('serves a generated PDF', async () => {
    const res = await request(app).get('/calendar-files/generated/calendar_99_test.pdf');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('application/pdf');
  });
});

describe('GET /imgs', () => {
  test('serves a PNG used by the calendar page', async () => {
    const res = await request(app).get('/imgs/wholeHeader.png');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('image/png');
  });

  test('serves an SVG logo', async () => {
    const res = await request(app).get('/imgs/jft%20white%20logo_NEW.svg');

    expect(res.status).toBe(200);
  });

  test('returns 404 for a non-image path', async () => {
    const res = await request(app).get('/imgs/../package.json');

    expect(res.status).toBe(404);
  });
});
