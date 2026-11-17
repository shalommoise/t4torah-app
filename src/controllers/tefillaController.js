const path = require('path');

// The Time4Tefilla config, ffmpeg and pipeline modules (which pull in the
// Castos and Mailchimp code) are required per request, not at load, so the
// public API never loads the send code just by starting (see
// __tests__/publicApp.test.js).
const tefillaConfig = () => require('../config/tefilla');
const ffmpeg = () => require('../services/tefilla/ffmpeg');
const pipeline = () => require('../services/tefilla/pipeline');

const ADMIN_DIR = path.join(__dirname, '..', 'admin');

const errorMessage = (error) => (error && error.message) || String(error);

const statusOf = (error) => {
  const status = Number(error && error.status);
  return Number.isInteger(status) && status >= 400 && status <= 599 ? status : 500;
};

/** The upload's multipart fields, parsed with the platform's FormData. */
const readForm = async (req) => {
  if (!Buffer.isBuffer(req.body) || !req.body.length) {
    throw Object.assign(new Error('Send multipart/form-data with an "audio" file and a "title"'), { status: 400 });
  }
  try {
    return await new Request('http://upload.local/', {
      method: 'POST',
      headers: { 'content-type': req.get('content-type') },
      body: req.body,
    }).formData();
  } catch (error) {
    throw Object.assign(new Error('Could not read the multipart form'), { status: 400 });
  }
};

const sendAdminFile = (name, type) => (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.type(type).sendFile(path.join(ADMIN_DIR, name));
};

/** GET /admin/time4tefilla: the upload page. */
const getUploadPage = sendAdminFile('tefillaUpload.html', 'html');

/** GET /admin/time4tefilla/upload.js: the page's script (the CSP blocks inline scripts). */
const getUploadScript = sendAdminFile('tefillaUpload.js', 'js');

/** GET /admin/time4tefilla/status: the modes this server allows, and whether ffmpeg runs. */
const getTefillaStatus = async (req, res) => {
  let modes = [];
  let configError = null;
  try {
    modes = tefillaConfig().getAllowedTefillaModes(process.env);
  } catch (error) {
    configError = errorMessage(error);
  }
  res.set('Cache-Control', 'no-store');
  res.json({ modes, configError, ffmpeg: await ffmpeg().checkFfmpeg() });
};

/**
 * POST /admin/time4tefilla/uploads (multipart: audio, title, mode).
 *
 * Errors come back as `{ ok: false, error, stage }` with their own status,
 * including provider errors (5xx): this route is admin-only, and the person
 * uploading needs to know what failed. API keys never appear in them.
 */
const uploadTefilla = async (req, res) => {
  try {
    const form = await readForm(req);
    const file = form.get('audio');
    const title = form.get('title');
    const config = tefillaConfig().getTefillaRunConfig(form.get('mode'), process.env);
    if (!file || typeof file === 'string') {
      throw Object.assign(new Error('An "audio" file is required'), { status: 400 });
    }
    const audio = Buffer.from(await file.arrayBuffer());
    // The API server's default DB user is read-only; send_log needs the write pool.
    const { runWithDatabaseRole } = require('../config/env');
    const result = await runWithDatabaseRole('write', () =>
      pipeline().runTefillaPipeline({ audio, title: typeof title === 'string' ? title : '', config })
    );
    res.json({ ok: true, ...result });
  } catch (error) {
    const status = statusOf(error);
    // eslint-disable-next-line no-console
    console.error(`[time4tefilla] upload failed (${status}${error.stage ? `, ${error.stage}` : ''}): ${errorMessage(error)}`);
    res.status(status).json({
      ok: false,
      error: errorMessage(error),
      ...(error.stage && { stage: error.stage }),
      ...(error.episodeId !== undefined && { episodeId: error.episodeId }),
    });
  }
};

module.exports = { getUploadPage, getUploadScript, getTefillaStatus, uploadTefilla };
