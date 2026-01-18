const express = require('express');
const healthController = require('../controllers/healthController');
const mishnaRouter = require('./mishnaRouter');
const sedarimRouter = require('./sedarimRouter');
const router = express.Router();

router.get('/health', healthController.getHealth);
router.use('/mishnas/', mishnaRouter);
router.use('/sedarim/', sedarimRouter);
module.exports = router;
