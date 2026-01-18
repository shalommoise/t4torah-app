const { selectMishnaById, selectMishnas } = require('../models/mishnaModel');
const { parsePagination } = require('../utils/pagination');

const parseOptionalInt = (value, name) => {
  if (value === undefined) {
    return { value: null };
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) {
    return { error: `${name} must be a number` };
  }
  return { value: parsed };
};

const getMishnas = async (req, res) => {
  const masechtaId = parseOptionalInt(req.query.masechta_id, 'masechta_id');
  if (masechtaId.error) {
    return res.status(400).json({ error: masechtaId.error });
  }
  const perek = parseOptionalInt(req.query.perek, 'perek');
  if (perek.error) {
    return res.status(400).json({ error: perek.error });
  }
  const mishna = parseOptionalInt(req.query.mishna, 'mishna');
  if (mishna.error) {
    return res.status(400).json({ error: mishna.error });
  }

  const pagination = parsePagination(req.query, { defaultLimit: 50, maxLimit: 200 });
  if (pagination.error) {
    return res.status(400).json({ error: pagination.error });
  }

  const mishnas = await selectMishnas(
    { masechtaId: masechtaId.value, perek: perek.value, mishna: mishna.value },
    pagination
  );
  res.json(mishnas);
};

const getMishnabyId = async (req, res) => {
    const mishnaId = req.params.mishnaId;
const mishna = await selectMishnaById(mishnaId);
  res.json(mishna);
};

module.exports = { getMishnas, getMishnabyId };
