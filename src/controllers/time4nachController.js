const {
  selectTime4NachShiurim,
  selectTime4NachShiurById,
  selectTime4NachSchedule,
  selectTime4NachScheduleById,
} = require('../models/time4nachModel');
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

const getTime4NachShiurim = async (req, res) => {
  const seferId = parseOptionalInt(req.query.sefer_id, 'sefer_id');
  if (seferId.error) {
    return res.status(400).json({ error: seferId.error });
  }
  const perek = parseOptionalInt(req.query.perek, 'perek');
  if (perek.error) {
    return res.status(400).json({ error: perek.error });
  }

  const shiurim = await selectTime4NachShiurim({
    seferId: seferId.value,
    perek: perek.value,
    shiurTitle: req.query.shiur_title,
  });
  res.json(shiurim);
};

const getTime4NachShiurById = async (req, res) => {
  const shiurId = req.params.shiurId;
  const shiur = await selectTime4NachShiurById(shiurId);
  if (!shiur.length) {
    return res.status(404).json({ error: 'Shiur not found' });
  }
  res.json(shiur[0]);
};

const getTime4NachSchedule = async (req, res) => {
  const dateId = parseOptionalInt(req.query.date_id, 'date_id');
  if (dateId.error) {
    return res.status(400).json({ error: dateId.error });
  }

  const pagination = parsePagination(req.query, { defaultLimit: 50, maxLimit: 200 });
  if (pagination.error) {
    return res.status(400).json({ error: pagination.error });
  }

  const schedule = await selectTime4NachSchedule({ dateId: dateId.value }, pagination);
  res.json(schedule);
};

const getTime4NachScheduleById = async (req, res) => {
  const dailyScheduleId = req.params.dailyScheduleId;
  const schedule = await selectTime4NachScheduleById(dailyScheduleId);
  if (!schedule.length) {
    return res.status(404).json({ error: 'Schedule entry not found' });
  }
  res.json(schedule[0]);
};

module.exports = {
  getTime4NachShiurim,
  getTime4NachShiurById,
  getTime4NachSchedule,
  getTime4NachScheduleById,
};
