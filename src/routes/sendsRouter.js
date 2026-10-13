const express = require('express');
const { getPreview, getPreviewHtml, getLog } = require('../controllers/sendsController');
const { requireSendsAdminToken } = require('../middleware/requireSendsAdminToken');

const sendsRouter = express.Router();

sendsRouter.use(requireSendsAdminToken());

sendsRouter.get('/preview', getPreview);
sendsRouter.get('/preview.html', getPreviewHtml);
sendsRouter.get('/log', getLog);

module.exports = sendsRouter;
