const { getSendPreview } = require('../services/sendPreviewService');

// Query values arrive as strings, or arrays when repeated; only single strings are accepted.
const queryValue = (value) => (typeof value === 'string' ? value : value === undefined ? undefined : '');

const getPreview = async (req, res, next) => {
  try {
    const preview = await getSendPreview({
      date: queryValue(req.query.date),
      program: queryValue(req.query.program),
      channel: queryValue(req.query.channel),
    });
    res.json(preview);
  } catch (error) {
    next(error);
  }
};

const getPreviewHtml = async (req, res, next) => {
  try {
    const preview = await getSendPreview({
      date: queryValue(req.query.date),
      program: queryValue(req.query.program),
      channel: 'email',
    });
    res.type('html').send(preview.email.html);
  } catch (error) {
    next(error);
  }
};

module.exports = { getPreview, getPreviewHtml };
