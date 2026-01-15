const express = require('express');
const healthController = require('../controllers/healthController');
const mishnaRouter = require('./mishnaRouter');
const router = express.Router();

router.get('/health', healthController.getHealth);
router.use('/mishnas/', mishnaRouter);

module.exports = router;
