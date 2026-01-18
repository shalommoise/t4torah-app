const express = require('express');
const { getMishnabyId, getMishnas } = require('../controllers/mishnaController');
const {validateNumericParam} = require("../middleware/validateParams")
const mishnaRouter = express.Router();

mishnaRouter
  .route("/")
  .get(getMishnas)
  .all((req, res) => {
    res.status(405).json({ error: 'Method not allowed' });
  });

mishnaRouter
  .route('/:mishnaId')
  .get(
    validateNumericParam('mishnaId'),
    getMishnabyId
  )
  .all((req, res) => {
    res.status(405).json({ error: 'Method not allowed' });
  });


module.exports = mishnaRouter;
