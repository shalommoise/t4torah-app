const express = require('express');
const {
  getTime4MishnaShiurim,
  getTime4MishnaShiurById,
  getTime4MishnaSchedule,
  getTime4MishnaScheduleById,
} = require('../controllers/time4mishnaController');
const { validateNumericParam } = require('../middleware/validateParams');

const time4mishnaRouter = express.Router();

time4mishnaRouter
  .route('/shiurim')
  .get(getTime4MishnaShiurim)
  .all((req, res) => {
    res.status(405).json({ error: 'Method not allowed' });
  });

time4mishnaRouter
  .route('/shiurim/:shiurId')
  .get(validateNumericParam('shiurId'), getTime4MishnaShiurById)
  .all((req, res) => {
    res.status(405).json({ error: 'Method not allowed' });
  });

time4mishnaRouter
  .route('/schedule')
  .get(getTime4MishnaSchedule)
  .all((req, res) => {
    res.status(405).json({ error: 'Method not allowed' });
  });

time4mishnaRouter
  .route('/schedule/:dailyScheduleId')
  .get(validateNumericParam('dailyScheduleId'), getTime4MishnaScheduleById)
  .all((req, res) => {
    res.status(405).json({ error: 'Method not allowed' });
  });

module.exports = time4mishnaRouter;
