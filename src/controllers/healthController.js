const healthService = require('../services/healthService');

const getHealth = (req, res) => {
  const status = healthService.getStatus();
  res.json(status);
};

module.exports = { getHealth };
