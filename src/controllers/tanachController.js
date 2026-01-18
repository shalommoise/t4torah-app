const { selectSefarim, selectSeferById } = require('../models/tanachModel');

const getSefarim = async (req, res) => {
  const sefarim = await selectSefarim({
    section: req.query.section,
    subsection: req.query.subsection,
    seferName: req.query.sefer_name,
  });
  res.json(sefarim);
};

const getSeferById = async (req, res) => {
  const seferId = req.params.seferId;
  const sefer = await selectSeferById(seferId);
  if (!sefer.length) {
    return res.status(404).json({ error: 'Sefer not found' });
  }
  res.json(sefer[0]);
};

module.exports = { getSefarim, getSeferById };
