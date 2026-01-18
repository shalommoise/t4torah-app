const {selectMasechtos, selectMaschechtaById}= require('../models/masechtaModel');

const getMasechtos = async (req, res) => {
    // Placeholder data; replace with actual data retrieval logic
    const masechtos = await selectMasechtos();
    res.json(masechtos);
};

const getMasechtaById = async (req, res) => {
    const masechtaId = req.params.masechtaId;
    const masechta = await selectMaschechtaById(masechtaId);
    res.json(masechta[0]);
};

module.exports = { getMasechtos, getMasechtaById };