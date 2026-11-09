const GENERIC_SERVER_ERROR = 'Internal server error';

const notFound = (req, res, next) => {
  res.status(404).json({ error: 'Not found' });
};

/** A 4xx status set on the error by our own code (or Express's body parser); anything else is a 500. */
const resolveStatus = (err) => {
  const status = Number(err && (err.status || err.statusCode));
  return Number.isInteger(status) && status >= 400 && status <= 599 ? status : 500;
};

/**
 * Sends 4xx messages to the client as written, since they describe the request.
 * For 5xx the message may come from MySQL, Chrome or a provider client, so the
 * client gets a generic body and the detail goes to the server log only.
 */
const errorHandler = (err, req, res, next) => {
  // eslint-disable-next-line no-console
  console.error(err);
  const status = resolveStatus(err);
  const message = status < 500 && err && err.message ? err.message : GENERIC_SERVER_ERROR;
  res.status(status).json({ error: message });
};

module.exports = { notFound, errorHandler, GENERIC_SERVER_ERROR };
