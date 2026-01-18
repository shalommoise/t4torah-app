const {
  selectDates,
  selectDateById,
  selectTime4MishnaScheduleByDateId,
  selectTime4NachScheduleByDateId,
} = require('../models/datesModel');
const { parsePagination } = require('../utils/pagination');

const parseBoolean = (value, name) => {
  if (value === undefined) {
    return { value: null };
  }
  if (value === 'true' || value === '1') {
    return { value: true };
  }
  if (value === 'false' || value === '0') {
    return { value: false };
  }
  return { error: `${name} must be a boolean` };
};

const getDates = async (req, res) => {
  const isYomTov = parseBoolean(req.query.is_yom_tov, 'is_yom_tov');
  if (isYomTov.error) {
    return res.status(400).json({ error: isYomTov.error });
  }

  const pagination = parsePagination(req.query, { defaultLimit: 50, maxLimit: 500 });
  if (pagination.error) {
    return res.status(400).json({ error: pagination.error });
  }

  const dates = await selectDates(
    {
      gregorianDate: req.query.gregorian_date,
      hebrewDate: req.query.hebrew_date,
      isYomTov: isYomTov.value,
      specialDate: req.query.special_date,
    },
    pagination
  );
  res.json(dates);
};

const getDateById = async (req, res) => {
  const dateId = req.params.dateId;
  const date = await selectDateById(dateId);
  if (!date.length) {
    return res.status(404).json({ error: 'Date not found' });
  }
  res.json(date[0]);
};

const getDateFull = async (req, res) => {
  const dateId = req.params.dateId;
  const date = await selectDateById(dateId);
  if (!date.length) {
    return res.status(404).json({ error: 'Date not found' });
  }

  const time4mishna = await selectTime4MishnaScheduleByDateId(dateId);
  const time4nach = await selectTime4NachScheduleByDateId(dateId);

  res.json({
    date: date[0],
    time4mishna_schedule: time4mishna,
    time4nach_schedule: time4nach,
  });
};

module.exports = { getDates, getDateById, getDateFull };
