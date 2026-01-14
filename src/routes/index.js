const express = require('express');
const healthController = require('../controllers/healthController');
const {getMishnabyId} = require('../controllers/mishnaController');
const router = express.Router();

router.get('/health', healthController.getHealth);
router.get('/mishna/:mishnaId', getMishnabyId)
module.exports = router;
