const {selectMishnaById} = require('../models/mishnaModel');

const getMishnabyId = async (req, res) => {
    const mishnaId = req.params.mishnaId;
const mishna = await selectMishnaById(mishnaId);
  res.json(mishna);
};

module.exports = { getMishnabyId };
