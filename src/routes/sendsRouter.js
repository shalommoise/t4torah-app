const express = require('express');
const { getPreview, getPreviewHtml } = require('../controllers/sendsController');

const sendsRouter = express.Router();

sendsRouter.get('/preview', getPreview);
sendsRouter.get('/preview.html', getPreviewHtml);

module.exports = sendsRouter;
