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
  // The Time4Tefilla upload converts every file with ffmpeg. Without it the
  // API keeps serving, but uploads fail and the page says so.
  require('./services/tefilla/ffmpeg')
    .checkFfmpeg()
    .then((ffmpeg) => {
      if (ffmpeg.ok) {
        // eslint-disable-next-line no-console
        console.log(`[time4tefilla] upload ready (${ffmpeg.version})`);
      } else {
        // eslint-disable-next-line no-console
        console.error(`[time4tefilla] UPLOADS WILL FAIL: ${ffmpeg.error}`);
      }
    });
});
