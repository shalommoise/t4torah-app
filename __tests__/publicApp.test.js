const path = require('path');
const { execFileSync } = require('child_process');
const request = require('supertest');

describe('public app surface', () => {
  test.each([
    '/api/v1/sends/preview?date=2026-09-28',
    '/api/v1/sends/preview.html?date=2026-09-28',
    '/api/v1/sends/log?date=2026-09-28',
    '/api/v1/sends/anything',
  ])('%s is not served (404)', async (url) => {
    const app = require('../src/app');
    const res = await request(app).get(url).set('Authorization', 'Bearer any-token');

    expect(res.status).toBe(404);
  });

  test('loading the app does not load the send, Mailchimp or Castos code', () => {
    // Jest keeps its own module registry, so load the app in a plain Node process
    // and list what it required. Nothing connects: the DB pool is created lazily.
    const script = `
      require('./src/app');
      const files = Object.keys(require.cache).filter((f) => !f.includes('node_modules'));
      process.stdout.write(JSON.stringify(files.map((f) => path.relative(process.cwd(), f))));
    `;
    const loaded = JSON.parse(
      execFileSync(process.execPath, ['-e', `const path = require('path');${script}`], {
        cwd: path.join(__dirname, '..'),
        encoding: 'utf8',
      })
    );

    expect(loaded).toContain(path.join('src', 'app.js'));
    const forbidden = loaded.filter((file) =>
      /^src[\\/](config[\\/](mailchimp|castos|email|send)\.js|services[\\/](mailchimp|castos)[\\/]|services[\\/](send|dailySend)\w*\.js)/.test(
        file
      )
    );
    expect(forbidden).toEqual([]);
  });
});
