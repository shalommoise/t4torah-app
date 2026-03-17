const fs = require('fs/promises');
const path = require('path');
const { execFile } = require('child_process');
const { promisify } = require('util');
const { pathToFileURL } = require('url');

const execFileAsync = promisify(execFile);
const GENERATED_DIR = path.join(process.cwd(), 'calendar', 'generated');
const CHROME_BIN = process.env.CHROME_BIN || '/usr/bin/google-chrome';

const buildCalendarUrl = ({ month, year, port }) => {
  const host = process.env.CALENDAR_EXPORT_HOST || 'http://127.0.0.1';
  return `${host}:${port}/calendar?month=${Number(month)}&year=${Number(year)}`;
};

const getOutputPaths = ({ month, year }) => {
  const monthPadded = String(month).padStart(2, '0');
  return {
    pdfPath: path.join(GENERATED_DIR, `calendar_${monthPadded}_${year}.pdf`),
    pngPath: path.join(GENERATED_DIR, `calendar_${monthPadded}_${year}.png`),
  };
};

const runChrome = async (args) => {
  await execFileAsync(CHROME_BIN, args, {
    env: {
      ...process.env,
      HOME: process.env.HOME,
    },
  });
};

const resolveSource = ({ sourceUrl, htmlPath, port, month, year }) => {
  if (sourceUrl) {
    return sourceUrl;
  }

  if (htmlPath) {
    return pathToFileURL(htmlPath).href;
  }

  return buildCalendarUrl({ month, year, port });
};

const buildCommonArgs = (source, needsLocalFileAccess) => {
  const args = [
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--hide-scrollbars',
  ];

  if (needsLocalFileAccess) {
    args.push('--allow-file-access-from-files');
  }

  args.push(source);
  return args;
};

const exportCalendarAssets = async ({ month, year, port, sourceUrl, htmlPath }) => {
  await fs.mkdir(GENERATED_DIR, { recursive: true });
  const source = resolveSource({ sourceUrl, htmlPath, port, month, year });
  const needsLocalFileAccess = source.startsWith('file:');
  const { pdfPath, pngPath } = getOutputPaths({ month, year });

  await runChrome([
    ...buildCommonArgs(source, needsLocalFileAccess).slice(0, -1),
    '--print-to-pdf-no-header',
    `--print-to-pdf=${pdfPath}`,
    source,
  ]);

  await runChrome([
    ...buildCommonArgs(source, needsLocalFileAccess).slice(0, -1),
    '--window-size=1240,1748',
    `--screenshot=${pngPath}`,
    source,
  ]);

  return { pdfPath, pngPath, source };
};

module.exports = {
  exportCalendarAssets,
};
