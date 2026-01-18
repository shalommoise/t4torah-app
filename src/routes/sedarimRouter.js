
const express = require('express');
const sedarimRouter = express.Router();
const {getSedarim} = require('../controllers/sedarimController');
sedarimRouter.route("/").get(getSedarim).all((req, res) => {
     res.status(405).json({ error: 'Method not allowed' });
});
module.exports = sedarimRouter;