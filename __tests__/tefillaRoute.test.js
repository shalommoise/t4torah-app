const request = require('supertest');
const app = require('../src/app');
const { runTefillaPipeline } = require('../src/services/tefilla/pipeline');
const { checkFfmpeg } = require('../src/services/tefilla/ffmpeg');
const { runWithDatabaseRole } = require('../src/config/env');

jest.mock('../src/services/tefilla/pipeline', () => ({ runTefillaPipeline: jest.fn() }));
jest.mock('../src/services/tefilla/ffmpeg', () => ({ checkFfmpeg: jest.fn() }));
jest.mock('../src/config/env', () => ({
  ...jest.requireActual('../src/config/env'),
  runWithDatabaseRole: jest.fn((role, fn) => fn()),
}));

const TOKEN = 'admin-token-for-tests-0123456789';
const BEARER = `Bearer ${TOKEN}`;
const basic = (password, user = 'admin') => `Basic ${Buffer.from(`${user}:${password}`).toString('base64')}`;
const OGG = Buffer.concat([Buffer.from('OggS'), Buffer.alloc(100)]);
const TITLE = '877. Which ‘Good Years’ Do We Refer To?';

const saved = {};
const ENV_NAMES = ['SENDS_ADMIN_TOKEN', 'TEFILLA_SEND_MODE'];

beforeEach(() => {
  jest.clearAllMocks();
  ENV_NAMES.forEach((name) => {
    saved[name] = process.env[name];
  });
  process.env.SENDS_ADMIN_TOKEN = TOKEN;
  delete process.env.TEFILLA_SEND_MODE;
  checkFfmpeg.mockResolvedValue({ ok: true, version: 'ffmpeg version 6' });
  runTefillaPipeline.mockResolvedValue({ status: 'dry-run', mode: 'dry-run', title: TITLE, outbox: {} });
});

afterEach(() => {
  ENV_NAMES.forEach((name) => {
    if (saved[name] === undefined) {
      delete process.env[name];
    } else {
      process.env[name] = saved[name];
    }
  });
});

const upload = (fields = {}, auth = BEARER) => {
  let req = request(app).post('/admin/time4tefilla/uploads').set('Authorization', auth);
  if (fields.audio !== null) {
    req = req.attach('audio', fields.audio || OGG, 'voice.ogg');
  }
  req = req.field('title', fields.title === undefined ? TITLE : fields.title);
  if (fields.mode) {
    req = req.field('mode', fields.mode);
  }
  return req;
};

describe('admin token', () => {
  test.each(['/admin/time4tefilla', '/admin/time4tefilla/upload.js', '/admin/time4tefilla/status'])(
    '%s asks the browser for credentials without the token',
    async (url) => {
      const res = await request(app).get(url);
      expect(res.status).toBe(401);
      expect(res.headers['www-authenticate']).toMatch(/^Basic realm="t4torah admin"/);
    }
  );

  test('the upload needs the token too', async () => {
    const res = await upload({}, 'Bearer wrong');
    expect(res.status).toBe(401);
    expect(runTefillaPipeline).not.toHaveBeenCalled();
  });

  test('Basic auth with the token as password opens the page (any user name)', async () => {
    const res = await request(app).get('/admin/time4tefilla').set('Authorization', basic(TOKEN, 'whoever'));
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/html/);
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.text).toContain('Time4Tefilla upload');
    expect(res.text).toContain('<script src="/admin/time4tefilla/upload.js"></script>');
  });

  test('Basic auth with the wrong password: 401', async () => {
    const res = await request(app).get('/admin/time4tefilla').set('Authorization', basic('wrong'));
    expect(res.status).toBe(401);
  });

  test('a Bearer token works for curl', async () => {
    const res = await request(app).get('/admin/time4tefilla/upload.js').set('Authorization', BEARER);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/javascript/);
  });

  test('503 when SENDS_ADMIN_TOKEN is not set', async () => {
    delete process.env.SENDS_ADMIN_TOKEN;
    const res = await request(app).get('/admin/time4tefilla').set('Authorization', basic(TOKEN));
    expect(res.status).toBe(503);
  });
});

describe('GET /admin/time4tefilla/status', () => {
  test('the allowed modes and the ffmpeg check', async () => {
    process.env.TEFILLA_SEND_MODE = 'test';
    const res = await request(app).get('/admin/time4tefilla/status').set('Authorization', BEARER);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ modes: ['dry-run', 'test'], configError: null, ffmpeg: { ok: true, version: 'ffmpeg version 6' } });
  });

  test('reports a bad TEFILLA_SEND_MODE and a missing ffmpeg', async () => {
    process.env.TEFILLA_SEND_MODE = 'nope';
    checkFfmpeg.mockResolvedValue({ ok: false, error: 'ffmpeg is not installed' });
    const res = await request(app).get('/admin/time4tefilla/status').set('Authorization', BEARER);
    expect(res.body).toMatchObject({ modes: [], configError: expect.stringContaining('TEFILLA_SEND_MODE'), ffmpeg: { ok: false } });
  });
});

describe('POST /admin/time4tefilla/uploads', () => {
  test('runs the pipeline on the write DB pool with the file, title and dry-run by default', async () => {
    const res = await upload();

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ ok: true, status: 'dry-run' });
    expect(runWithDatabaseRole).toHaveBeenCalledWith('write', expect.any(Function));
    const [{ audio, title, config }] = runTefillaPipeline.mock.calls[0];
    expect(Buffer.isBuffer(audio)).toBe(true);
    expect(audio.equals(OGG)).toBe(true);
    expect(title).toBe(TITLE);
    expect(config.mode).toBe('dry-run');
  });

  test('a mode above TEFILLA_SEND_MODE is refused before anything runs', async () => {
    process.env.TEFILLA_SEND_MODE = 'test';
    const res = await upload({ mode: 'live' });
    expect(res.status).toBe(403);
    expect(res.body).toEqual({ ok: false, error: 'mode "live" is not allowed on this server (TEFILLA_SEND_MODE is "test")' });
    expect(runTefillaPipeline).not.toHaveBeenCalled();
  });

  test('a missing file: 400', async () => {
    const res = await upload({ audio: null });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('An "audio" file is required');
  });

  test('not multipart: 400', async () => {
    const res = await request(app)
      .post('/admin/time4tefilla/uploads')
      .set('Authorization', BEARER)
      .send({ title: TITLE });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/multipart\/form-data/);
  });

  test('pipeline errors keep their status, message and stage, including 5xx', async () => {
    runTefillaPipeline.mockRejectedValue(
      Object.assign(new Error('The episode audio did not return 200'), { status: 502, stage: 'verify-audio', episodeId: 555 })
    );
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const res = await upload();
    expect(res.status).toBe(502);
    expect(res.body).toEqual({ ok: false, error: 'The episode audio did not return 200', stage: 'verify-audio', episodeId: 555 });
  });

  test('already sent: 409', async () => {
    runTefillaPipeline.mockRejectedValue(Object.assign(new Error('already went out'), { status: 409, stage: 'send_log' }));
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const res = await upload();
    expect(res.status).toBe(409);
  });
});
