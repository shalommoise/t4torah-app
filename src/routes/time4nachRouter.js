const express = require('express');
const {
  getTime4NachShiurim,
  getTime4NachShiurById,
  getTime4NachSchedule,
  getTime4NachScheduleById,
} = require('../controllers/time4nachController');
const { validateNumericParam } = require('../middleware/validateParams');

const time4nachRouter = express.Router();

time4nachRouter
  .route('/shiurim')
  .get(getTime4NachShiurim)
  .all((req, res) => {
    res.status(405).json({ error: 'Method not allowed' });
  });

time4nachRouter
  .route('/shiurim/:shiurId')
  .get(validateNumericParam('shiurId'), getTime4NachShiurById)
  .all((req, res) => {
    res.status(405).json({ error: 'Method not allowed' });
  });

time4nachRouter
  .route('/schedule')
  .get(getTime4NachSchedule)
  .all((req, res) => {
    res.status(405).json({ error: 'Method not allowed' });
  });

time4nachRouter
  .route('/schedule/:dailyScheduleId')
  .get(validateNumericParam('dailyScheduleId'), getTime4NachScheduleById)
  .all((req, res) => {
    res.status(405).json({ error: 'Method not allowed' });
  });

module.exports = time4nachRouter;
