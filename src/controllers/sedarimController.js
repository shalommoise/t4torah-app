const {showSedarim} = require('../models/sedarimModel');  

const getSedarim = async (req, res) => {
    const sedarim =  await showSedarim();
    res.json(sedarim);
};

module.exports = { getSedarim };