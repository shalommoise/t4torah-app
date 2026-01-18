require('dotenv').config();

const {formFileName} = require("../../utils/findFile");
const {
  selectTime4MishnaShiurim,
  selectTime4MishnaShiurById,
  selectTime4MishnaSchedule,
  selectTime4MishnaScheduleById,
} = require('../models/time4mishnaModel');
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

const getTime4MishnaShiurim = async (req, res) => {
  const startMishna = parseOptionalInt(req.query.start_mishna, 'start_mishna');
  if (startMishna.error) {
    return res.status(400).json({ error: startMishna.error });
  }
  const endMishna = parseOptionalInt(req.query.end_mishna, 'end_mishna');
  if (endMishna.error) {
    return res.status(400).json({ error: endMishna.error });
  }

  const shiurim = await selectTime4MishnaShiurim({
    startMishna: startMishna.value,
    endMishna: endMishna.value,
    shiurTitle: req.query.shiur_title,
  });
  res.json(shiurim);
};

const getTime4MishnaShiurById = async (req, res) => {
  const shiurId = req.params.shiurId;
  const shiur = await selectTime4MishnaShiurById(shiurId);
  if (!shiur.length) {
    return res.status(404).json({ error: 'Shiur not found' });
  }
  shiur[0].shiur_link = formFileName('mishna','shiurim', shiur[0].shiur_title.split(' ').join('_'),"mp3");
  res.json(shiur[0]);
};

const getTime4MishnaSchedule = async (req, res) => {
  const dateId = parseOptionalInt(req.query.date_id, 'date_id');
  if (dateId.error) {
    return res.status(400).json({ error: dateId.error });
  }

  const pagination = parsePagination(req.query, { defaultLimit: 50, maxLimit: 200 });
  if (pagination.error) {
    return res.status(400).json({ error: pagination.error });
  }

  const schedule = await selectTime4MishnaSchedule({ dateId: dateId.value }, pagination);
  res.json(schedule);
};

const getTime4MishnaScheduleById = async (req, res) => {
  const dailyScheduleId = req.params.dailyScheduleId;
  const schedule = await selectTime4MishnaScheduleById(dailyScheduleId);
  if (!schedule.length) {
    return res.status(404).json({ error: 'Schedule entry not found' });
  }
  res.json(schedule[0]);
};

module.exports = {
  getTime4MishnaShiurim,
  getTime4MishnaShiurById,
  getTime4MishnaSchedule,
  getTime4MishnaScheduleById,
};
