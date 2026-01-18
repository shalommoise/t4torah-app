const express = require('express');
const routes = require('./routes');
const { notFound, errorHandler } = require('./middleware/error');

const app = express();

app.use(express.json());
app.use('/api/v1', routes);
app.use(notFound);
app.use(errorHandler);

module.exports = app;
