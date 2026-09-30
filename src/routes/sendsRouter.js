const express = require('express');
const { getPreview, getPreviewHtml, getLog } = require('../controllers/sendsController');

const sendsRouter = express.Router();

sendsRouter.get('/preview', getPreview);
sendsRouter.get('/preview.html', getPreviewHtml);
sendsRouter.get('/log', getLog);

module.exports = sendsRouter;
