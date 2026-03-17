const express = require('express');
const path = require('path');
const routes = require('./routes');
const calendarRouter = require('./routes/calendarRouter');
const { notFound, errorHandler } = require('./middleware/error');
const cors = require("cors");
const app = express();
app.use(cors());
app.use(express.json());
app.use('/imgs', express.static(path.join(process.cwd(), 'imgs')));
app.use('/calendar-files', express.static(path.join(process.cwd(), 'calendar')));
app.use(calendarRouter);
app.use('/api/v1', routes);
app.use(notFound);
app.use(errorHandler);

module.exports = app;
