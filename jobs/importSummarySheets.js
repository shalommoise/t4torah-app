#!/usr/bin/env node
// Summary sheets import: `npm run import:summaries -- <inventory.csv> --files=<dir> [--out=<dir>] [--dry-run=false]`
// and `npm run import:summaries -- --check-bucket`. See docs/SUMMARY_SHEETS.md.
//
// Exit codes: 0 ok, 1 inventory errors or files missing from the bucket,
// 2 usage/config error.

const fs = require('fs/promises');

const USAGE = `Usage:
  npm run import:summaries -- <inventory.csv> --files=<dir> [--out=<dir>] [--dry-run=false]
  npm run import:summaries -- --check-bucket

  <inventory.csv>             One row per PDF (template: db/data/summary_sheets_template.csv)
  --files=<dir>               Folder the inventory's "file" paths are relative to
  --out=<dir>                 Staging folder; files are copied to <dir>/<bucket key>
                              (required with --dry-run=false)
  --dry-run[=true|false]      Default true: check everything, write nothing
  --check-bucket              Check every summary_sheets file is reachable at BUCKET_PATH
  --help                      Show this help`;

const EXIT_OK = 0;
const EXIT_FAILURE = 1;
const EXIT_USAGE = 2;

class UsageError extends Error {}

/**
 * Parses CLI arguments. Pure: no environment or I/O.
 *
 * @param {string[]} argv Arguments after the script name.
 * @returns {{ help: boolean, checkBucket: boolean, dryRun: boolean, inventory?: string, filesDir?: string, outDir?: string }}
 * @throws {UsageError}
 */
const parseArgs = (argv) => {
  const args = { help: false, checkBucket: false, dryRun: true };
  const seen = new Set();

  for (const arg of argv) {
    const match = /^--([a-z-]+)(?:=(.*))?$/.exec(arg);
    if (!match) {
      if (arg.startsWith('-') || args.inventory) {
        throw new UsageError(`Unexpected argument: ${arg}`);
      }
      args.inventory = arg;
      continue;
    }
    const [, name, value] = match;
    if (seen.has(name)) {
      throw new UsageError(`--${name} given more than once`);
    }
    seen.add(name);

    switch (name) {
      case 'help':
        args.help = true;
        break;
      case 'check-bucket':
        args.checkBucket = true;
        break;
      case 'dry-run':
        if (value !== undefined && value !== 'true' && value !== 'false') {
          throw new UsageError(`--dry-run must be true or false (got "${value}")`);
        }
        args.dryRun = value !== 'false';
        break;
      case 'files':
      case 'out':
        if (!value) {
          throw new UsageError(`--${name} needs a folder (--${name}=<dir>)`);
        }
        args[name === 'files' ? 'filesDir' : 'outDir'] = value;
        break;
      default:
        throw new UsageError(`Unknown option: --${name}`);
    }
  }

  if (args.help) {
    return args;
  }
  if (args.checkBucket) {
    if (args.inventory || args.filesDir || args.outDir) {
      throw new UsageError('--check-bucket takes no inventory, --files or --out');
    }
    return args;
  }
  if (!args.inventory) {
    throw new UsageError('Give the inventory CSV');
  }
  if (!args.filesDir) {
    throw new UsageError('--files=<dir> is required');
  }
  if (!args.dryRun && !args.outDir) {
    throw new UsageError('--out=<dir> is required with --dry-run=false');
  }
  return args;
};

/**
 * Human-readable report lines for an import.
 *
 * @param {Awaited<ReturnType<typeof import('../src/services/summarySheetImportService').importSummarySheets>>} report
 * @returns {string[]}
 */
const formatImportReport = (report) => {
  const lines = report.errors.map(({ row, message }) => `  row ${row}: ${message}`);
  if (report.errors.length) {
    lines.unshift(`${report.errors.length} row(s) with errors; nothing was written:`);
    return lines;
  }
  if (!report.written) {
    lines.push(`[dry-run] ${report.sheets.length} row(s) OK. Would write:`);
    report.sheets.forEach((sheet) => lines.push(`  row ${sheet.row}: ${sheet.bucketKey}`));
    return lines;
  }
  lines.push(`Wrote ${report.results.length} file(s):`);
  report.results.forEach((result) => lines.push(`  row ${result.row}: ${result.bucketKey} (${result.action})`));
  return lines;
};

/**
 * Runs the import or the bucket check. Dependencies are injectable for tests.
 *
 * @returns {Promise<number>} exit code
 */
const main = async (
  argv,
  {
    env = process.env,
    log = console.log,
    error = console.error,
    readFile = (file) => fs.readFile(file, 'utf8'),
    service = require('../src/services/summarySheetImportService'),
  } = {}
) => {
  let args;
  try {
    args = parseArgs(argv);
  } catch (parseError) {
    if (parseError instanceof UsageError) {
      error(`${parseError.message}\n\n${USAGE}`);
      return EXIT_USAGE;
    }
    throw parseError;
  }
  if (args.help) {
    log(USAGE);
    return EXIT_OK;
  }

  if (args.checkBucket) {
    if (!env.BUCKET_PATH || !env.BUCKET_PATH.trim()) {
      error('BUCKET_PATH is not set');
      return EXIT_USAGE;
    }
    const { checked, missing } = await service.checkBucket({ bucketUrl: env.BUCKET_PATH.trim() });
    log(`Checked ${checked} file(s); ${missing.length} missing.`);
    missing.forEach((url) => log(`  missing: ${url}`));
    return missing.length ? EXIT_FAILURE : EXIT_OK;
  }

  let csvText;
  try {
    csvText = await readFile(args.inventory);
  } catch (readError) {
    error(`Cannot read ${args.inventory}: ${readError.message}`);
    return EXIT_USAGE;
  }
  let report;
  try {
    report = await service.importSummarySheets({
      csvText,
      filesDir: args.filesDir,
      outDir: args.outDir,
      dryRun: args.dryRun,
    });
  } catch (importError) {
    // A malformed inventory (missing column, unclosed quote).
    error(importError.message);
    return EXIT_USAGE;
  }
  formatImportReport(report).forEach((line) => (report.errors.length ? error(line) : log(line)));
  return report.errors.length ? EXIT_FAILURE : EXIT_OK;
};

if (require.main === module) {
  require('dotenv').config();
  main(process.argv.slice(2))
    .then((code) => {
      process.exitCode = code;
    })
    .catch((fatal) => {
      console.error(fatal);
      process.exitCode = EXIT_FAILURE;
    })
    .finally(() => require('../src/config/env').pool.end());
}

module.exports = { parseArgs, formatImportReport, main, UsageError, USAGE };
