const express = require('express');
const healthController = require('../controllers/healthController');
const mishnaRouter = require('./mishnaRouter');
const sedarimRouter = require('./sedarimRouter');
const masechtaRouter = require('./masechtaRouter');
const router = express.Router();

router.get('/health', healthController.getHealth);
router.use('/mishnas/', mishnaRouter);
router.use('/sedarim/', sedarimRouter);
router.use('/masechtos/', masechtaRouter);
module.exports = router;
