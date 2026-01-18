
const express = require('express');
const masechtaRouter = express.Router();
const {getMasechtos, getMasechtaById} = require('../controllers/masechtosController');
const {validateNumericParam} = require("../middleware/validateParams")

masechtaRouter.route("/").get(getMasechtos).all((req, res) => {
     res.status(405).json({ error: 'Method not allowed' });
});

masechtaRouter
  .route('/:masechtaId')
  .get(validateNumericParam('masechtaId'), getMasechtaById)
  .all((req, res) => {
    res.status(405).json({ error: 'Method not allowed' });
  });
module.exports = masechtaRouter;