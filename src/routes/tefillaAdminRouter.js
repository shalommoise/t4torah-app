const express = require('express');
const { requireAdminToken } = require('../middleware/requireAdminToken');
const { getUploadPage, getUploadScript, getTefillaStatus, uploadTefilla } = require('../controllers/tefillaController');

// A 3-5 minute voice note is a few MB; this leaves room for a long M4A.
const MAX_UPLOAD = '50mb';

/**
 * The Time4Tefilla admin page and upload, mounted at /admin/time4tefilla.
 * Every route needs SENDS_ADMIN_TOKEN: as a Bearer token (curl), or as the
 * password of the browser's Basic auth prompt (the page).
 *
 * @param {{ auth?: import('express').RequestHandler }} [options] For tests.
 */
const createTefillaAdminRouter = ({ auth = requireAdminToken({ allowBasic: true }) } = {}) => {
  const router = express.Router();
  router.use(auth);
  router.get('/', getUploadPage);
  router.get('/upload.js', getUploadScript);
  router.get('/status', getTefillaStatus);
  router.post('/uploads', express.raw({ type: 'multipart/form-data', limit: MAX_UPLOAD }), uploadTefilla);
  return router;
};

module.exports = { createTefillaAdminRouter };
