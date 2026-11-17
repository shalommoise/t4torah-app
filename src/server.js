const http = require('http');
const { port, useDatabaseRole } = require('./config/env');

// The public API only reads. Set the role before the app (and its models) load.
useDatabaseRole('read');

const app = require('./app');

const server = http.createServer(app);

server.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Server listening on ${port}`);
  // The daily email and Castos runs. Off unless SCHEDULER_ENABLED=true; uses
  // its own write pool, so the API stays read-only.
  require('./services/scheduler').startScheduler();
});
