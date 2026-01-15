// middleware/validateNumericParam.js
const validateNumericParam = (paramName) => (req, res, next) => {
  const value = req.params[paramName];

  if (!Number.isInteger(Number(value))) {
    return res.status(400).json({ error: `${paramName} must be a number` });
  }

  next();
};

module.exports = {validateNumericParam};
