const fs = require('fs/promises');
const path = require('path');
const { execFile } = require('child_process');
const { promisify } = require('util');
const { pathToFileURL } = require('url');

const execFileAsync = promisify(execFile);
const GENERATED_DIR = path.join(process.cwd(), 'calendar', 'generated');
const CHROME_BIN = process.env.CHROME_BIN || '/usr/bin/google-chrome';

/** The calendar card's width in template.html (`.page { max-width: 1100px }`). */
const CARD_WIDTH = 1100;
/** Viewport height for measuring the card; taller than any month renders. */
const MEASURE_HEIGHT = 4000;

const buildCalendarUrl = ({ month, year, port }) => {
  const host = process.env.CALENDAR_EXPORT_HOST || 'http://127.0.0.1';
  return `${host}:${port}/calendar?month=${Number(month)}&year=${Number(year)}`;
};

/**
 * The bucket name for a month's calendar image, e.g. (10, 2026) → `T4M-10-26.png`.
 * Matches `getCalendarUrl` in src/services/render/emailLinks.js.
 */
const getPngFileName = ({ month, year }) => {
  const monthPadded = String(Number(month)).padStart(2, '0');
  const yearShort = String(Number(year) % 100).padStart(2, '0');
  return `T4M-${monthPadded}-${yearShort}.png`;
};

const getOutputPaths = ({ month, year }) => {
  const monthPadded = String(Number(month)).padStart(2, '0');
  return {
    pdfPath: path.join(GENERATED_DIR, `calendar_${monthPadded}_${year}.pdf`),
    pngPath: path.join(GENERATED_DIR, getPngFileName({ month, year })),
  };
};

const runChrome = async (args) => {
  const { stdout } = await execFileAsync(CHROME_BIN, args, {
    env: {
      ...process.env,
      HOME: process.env.HOME,
    },
    maxBuffer: 20 * 1024 * 1024,
  });
  return stdout;
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

const buildCommonArgs = (needsLocalFileAccess) => {
  const args = [
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--hide-scrollbars',
  ];

  if (needsLocalFileAccess) {
    args.push('--allow-file-access-from-files');
  }

  return args;
};

/** `source` with its fragment replaced by `#export` (template.html's PNG mode). */
const toExportSource = (source) => `${source.split('#')[0]}#export`;

/**
 * Reads the card height template.html writes to `data-export-height` in export mode.
 * @param {string} dom The page's DOM as printed by `chrome --dump-dom`.
 * @returns {number}
 */
const parseExportHeight = (dom) => {
  const match = /data-export-height="(\d+)"/.exec(dom || '');
  const height = match ? Number(match[1]) : 0;
  if (!height) {
    throw new Error('calendar page did not report its height (data-export-height missing)');
  }
  return height;
};

/**
 * Screenshots just the calendar card, with nothing around it: first loads the
 * page to measure the card, then captures a viewport exactly that size.
 */
const exportCardPng = async ({ source, needsLocalFileAccess, pngPath }) => {
  const exportSource = toExportSource(source);
  const common = buildCommonArgs(needsLocalFileAccess);

  const dom = await runChrome([
    ...common,
    `--window-size=${CARD_WIDTH},${MEASURE_HEIGHT}`,
    '--dump-dom',
    exportSource,
  ]);
  const height = parseExportHeight(dom);

  await runChrome([
    ...common,
    `--window-size=${CARD_WIDTH},${height}`,
    '--default-background-color=00000000',
    `--screenshot=${pngPath}`,
    exportSource,
  ]);
};

const exportCalendarAssets = async ({ month, year, port, sourceUrl, htmlPath }) => {
  await fs.mkdir(GENERATED_DIR, { recursive: true });
  const source = resolveSource({ sourceUrl, htmlPath, port, month, year });
  const needsLocalFileAccess = source.startsWith('file:');
  const { pdfPath, pngPath } = getOutputPaths({ month, year });

  await runChrome([
    ...buildCommonArgs(needsLocalFileAccess),
    '--print-to-pdf-no-header',
    `--print-to-pdf=${pdfPath}`,
    source,
  ]);

  await exportCardPng({ source, needsLocalFileAccess, pngPath });

  return { pdfPath, pngPath, source };
};

module.exports = {
  exportCalendarAssets,
  getPngFileName,
  parseExportHeight,
  toExportSource,
};
