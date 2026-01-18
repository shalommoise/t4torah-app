const express = require('express');
const { getDates, getDateById, getDateFull } = require('../controllers/datesController');
const { validateNumericParam } = require('../middleware/validateParams');

const datesRouter = express.Router();

datesRouter
  .route('/')
  .get(getDates)
  .all((req, res) => {
    res.status(405).json({ error: 'Method not allowed' });
  });

datesRouter
  .route('/:dateId/full')
  .get(validateNumericParam('dateId'), getDateFull)
  .all((req, res) => {
    res.status(405).json({ error: 'Method not allowed' });
  });

datesRouter
  .route('/:dateId')
  .get(validateNumericParam('dateId'), getDateById)
  .all((req, res) => {
    res.status(405).json({ error: 'Method not allowed' });
  });

module.exports = datesRouter;
