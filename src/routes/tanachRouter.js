const express = require('express');
const { getSefarim, getSeferById } = require('../controllers/tanachController');
const { validateNumericParam } = require('../middleware/validateParams');

const tanachRouter = express.Router();

tanachRouter
  .route('/')
  .get(getSefarim)
  .all((req, res) => {
    res.status(405).json({ error: 'Method not allowed' });
  });

tanachRouter
  .route('/:seferId')
  .get(validateNumericParam('seferId'), getSeferById)
  .all((req, res) => {
    res.status(405).json({ error: 'Method not allowed' });
  });

module.exports = tanachRouter;
