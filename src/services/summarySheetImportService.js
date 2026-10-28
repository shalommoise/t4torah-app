const fs = require('fs/promises');
const path = require('path');
const axios = require('axios');
const {
  selectMishnaRange,
  selectSederMishnaRange,
  upsertSummarySheet,
  selectSummarySheetKeys,
} = require('../models/summarySheetModel');

// Imports the summary-sheet inventory (see db/data/summary_sheets_template.csv
// and docs/SUMMARY_SHEETS.md): one CSV row per PDF, saying which mishnayos it
// covers. Each file is copied into a staging folder at its bucket key and
// recorded in summary_sheets; uploading the staging folder is a separate step.

const KINDS = ['summary', 'diagram', 'chart', 'overview', 'key_terms', 'cover', 'mikra', 'test', 'back_matter'];
const REQUIRED_COLUMNS = ['file', 'masechta', 'start', 'end', 'kind', 'part'];
const BUCKET_FOLDER = 'mishna/summaries/sheets';
const CHECK_BATCH_SIZE = 10;
const HEAD_TIMEOUT_MS = 5000;

/**
 * Splits CSV text into rows of fields. Handles quoted fields (with commas,
 * newlines and "" escapes), CRLF line endings and a leading BOM. Blank lines
 * are dropped.
 *
 * @param {string} text
 * @returns {string[][]}
 */
const parseCsv = (text) => {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  const input = String(text).replace(/^﻿/, '');

  const endField = () => {
    row.push(field);
    field = '';
  };
  const endRow = () => {
    endField();
    if (row.some((value) => value.trim() !== '')) {
      rows.push(row);
    }
    row = [];
  };

  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];
    if (inQuotes) {
      if (char === '"' && input[i + 1] === '"') {
        field += '"';
        i += 1;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        field += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      endField();
    } else if (char === '\n') {
      endRow();
    } else if (char !== '\r') {
      field += char;
    }
  }
  if (inQuotes) {
    throw new Error('CSV ends inside a quoted field');
  }
  endRow();
  return rows;
};

/**
 * The inventory's data rows as `{ row, values }`, where `row` is the
 * spreadsheet row number (the header is row 1) and `values` is keyed by
 * lower-cased column name. Extra columns (e.g. notes) are kept but ignored.
 *
 * @param {string} csvText
 * @returns {{ row: number, values: Record<string, string> }[]}
 * @throws {Error} when a required column is missing.
 */
const readInventory = (csvText) => {
  const [header = [], ...dataRows] = parseCsv(csvText);
  const columns = header.map((name) => name.trim().toLowerCase());
  const missing = REQUIRED_COLUMNS.filter((name) => !columns.includes(name));
  if (missing.length) {
    throw new Error(`Inventory is missing column(s): ${missing.join(', ')}`);
  }
  return dataRows.map((fields, index) => ({
    row: index + 2,
    values: Object.fromEntries(columns.map((name, column) => [name, (fields[column] || '').trim()])),
  }));
};

/**
 * `"3"` → whole perek 3; `"3:4"` or `"3.4"` → perek 3 mishna 4; `""` → null.
 *
 * @param {string} text
 * @param {string} label Column name, for the error message.
 * @returns {{ perek: number, mishna: number|null }|null}
 */
const parsePosition = (text, label) => {
  if (!text) {
    return null;
  }
  const match = /^(\d+)(?:[:.](\d+))?$/.exec(text);
  if (!match || Number(match[1]) < 1 || (match[2] !== undefined && Number(match[2]) < 1)) {
    throw new Error(`${label} must be a perek ("3") or perek:mishna ("3:4") (got "${text}")`);
  }
  return { perek: Number(match[1]), mishna: match[2] === undefined ? null : Number(match[2]) };
};

/**
 * Validates one inventory row. Blank kind means summary, blank part means 1,
 * and blank start and end together mean the whole masechta.
 *
 * @param {Record<string, string>} values
 * @returns {{ file: string, masechta: string, kind: string, part: number, start: object|null, end: object|null }}
 * @throws {Error}
 */
const parseInventoryRow = (values) => {
  const { file } = values;
  if (!file) {
    throw new Error('file is empty');
  }
  if (!/\.pdf$/i.test(file)) {
    throw new Error(`file must be a .pdf (got "${file}")`);
  }

  const masechta = values.masechta.replace(/[-_]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!masechta) {
    throw new Error('masechta is empty');
  }

  const kind = (values.kind || 'summary').toLowerCase().replace(/[\s-]+/g, '_');
  if (!KINDS.includes(kind)) {
    throw new Error(`kind must be one of ${KINDS.join(', ')} (got "${values.kind}")`);
  }

  const partText = values.part || '1';
  if (!/^\d+$/.test(partText) || Number(partText) < 1) {
    throw new Error(`part must be a whole number from 1 (got "${values.part}")`);
  }

  const start = parsePosition(values.start, 'start');
  const end = parsePosition(values.end, 'end');
  if (Boolean(start) !== Boolean(end)) {
    throw new Error('start and end must both be filled in, or both left empty for the whole masechta');
  }

  return { file, masechta, kind, part: Number(partText), start, end };
};

const formatPosition = ({ perek, mishna }) => (mishna === null ? `${perek}` : `${perek}-${mishna}`);

const describePosition = ({ perek, mishna }) => (mishna === null ? `perek ${perek}` : `${perek}:${mishna}`);

/**
 * The bucket key for a sheet, e.g.
 * `mishna/summaries/sheets/Bava-Kama/Bava-Kama_summary_3_to_4-2_1.pdf`.
 * The range is written as given (`3`, `3-4`), or `all` for a whole masechta.
 *
 * @param {{ masechtaName: string, kind: string, start: object|null, end: object|null, part: number }} sheet
 * @returns {string}
 */
const buildBucketKey = ({ masechtaName, kind, start, end, part }) => {
  const slug = masechtaName.trim().split(/\s+/).join('-');
  let range = 'all';
  if (start && end) {
    const from = formatPosition(start);
    const to = formatPosition(end);
    range = from === to ? from : `${from}_to_${to}`;
  }
  return `${BUCKET_FOLDER}/${slug}/${slug}_${kind}_${range}_${part}.pdf`;
};

/**
 * A row whose masechta column names a seder (`Zeraim` or `Seder Zeraim`)
 * covers the whole seder, filed under `Seder-<Name>`.
 *
 * @returns {Promise<object|null>} `null` when no seder matches.
 * @throws {Error} when a seder row has a start or end.
 */
const resolveSederSheet = async (spec) => {
  const seder = await selectSederMishnaRange(spec.masechta.replace(/^seder\s+/i, ''));
  if (!seder) {
    return null;
  }
  if (spec.start) {
    throw new Error(`${seder.seder_name} is a seder: leave start and end empty`);
  }
  return {
    kind: spec.kind,
    part: spec.part,
    startMishna: seder.first_mishna_id,
    endMishna: seder.last_mishna_id,
    bucketKey: buildBucketKey({ ...spec, masechtaName: `Seder ${seder.seder_name}` }),
  };
};

/**
 * Turns a parsed row into mishna ids and a bucket key. A perek-only start
 * means its first mishna; a perek-only end means its last. A seder name in
 * the masechta column covers the whole seder (see resolveSederSheet).
 *
 * @param {ReturnType<typeof parseInventoryRow>} spec
 * @returns {Promise<{ kind: string, part: number, startMishna: number, endMishna: number, bucketKey: string }>}
 * @throws {Error}
 */
const resolveSheet = async (spec) => {
  const { masechta, start, end } = spec;
  const whole = await selectMishnaRange({ masechta });
  if (!whole) {
    const sederSheet = await resolveSederSheet(spec);
    if (sederSheet) {
      return sederSheet;
    }
    throw new Error(`Unknown masechta or seder "${masechta}"`);
  }
  let startMishna = whole.first_mishna_id;
  let endMishna = whole.last_mishna_id;
  if (start) {
    const from = await selectMishnaRange({ masechta, ...start });
    const to = await selectMishnaRange({ masechta, ...end });
    if (!from) {
      throw new Error(`${whole.masechta_name} has no ${describePosition(start)}`);
    }
    if (!to) {
      throw new Error(`${whole.masechta_name} has no ${describePosition(end)}`);
    }
    startMishna = from.first_mishna_id;
    endMishna = to.last_mishna_id;
  }
  if (startMishna > endMishna) {
    throw new Error('start is after end');
  }
  return {
    kind: spec.kind,
    part: spec.part,
    startMishna,
    endMishna,
    bucketKey: buildBucketKey({ ...spec, masechtaName: whole.masechta_name }),
  };
};

const sourceExists = async (sourcePath) => {
  try {
    return (await fs.stat(sourcePath)).isFile();
  } catch (_error) {
    return false;
  }
};

/**
 * Validates every inventory row against the database and the files folder.
 * Reads only.
 *
 * @param {{ row: number, values: Record<string, string> }[]} records
 * @param {{ filesDir: string }} options
 * @returns {Promise<{ sheets: object[], errors: { row: number, message: string }[] }>}
 */
const planImport = async (records, { filesDir }) => {
  const sheets = [];
  const errors = [];
  const rowByKey = new Map();

  for (const { row, values } of records) {
    try {
      const spec = parseInventoryRow(values);
      const sheet = await resolveSheet(spec);
      const sourcePath = path.resolve(filesDir, spec.file);
      if (!(await sourceExists(sourcePath))) {
        throw new Error(`file not found: ${sourcePath}`);
      }
      if (rowByKey.has(sheet.bucketKey)) {
        throw new Error(`same masechta, kind, range and part as row ${rowByKey.get(sheet.bucketKey)}`);
      }
      rowByKey.set(sheet.bucketKey, row);
      sheets.push({ ...sheet, row, sourcePath, sourceRef: spec.file });
    } catch (error) {
      errors.push({ row, message: error.message });
    }
  }
  return { sheets, errors };
};

/**
 * Checks the whole inventory, then (unless dry-run or any row has an error)
 * copies each file to `<outDir>/<bucketKey>` and upserts its summary_sheets
 * row. Nothing is written when any row is invalid, so a fixed inventory can
 * simply be re-run; re-running is safe because rows are keyed by bucket key.
 *
 * @param {{ csvText: string, filesDir: string, outDir?: string, dryRun?: boolean }} options
 * @returns {Promise<{ dryRun: boolean, written: boolean, sheets: object[], errors: object[], results: object[] }>}
 */
const importSummarySheets = async ({ csvText, filesDir, outDir, dryRun = true }) => {
  const { sheets, errors } = await planImport(readInventory(csvText), { filesDir });
  if (dryRun || errors.length) {
    return { dryRun, written: false, sheets, errors, results: [] };
  }
  if (!outDir) {
    throw new Error('outDir is required unless dry-run');
  }

  const results = [];
  for (const sheet of sheets) {
    const destination = path.join(outDir, ...sheet.bucketKey.split('/'));
    await fs.mkdir(path.dirname(destination), { recursive: true });
    await fs.copyFile(sheet.sourcePath, destination);
    const action = await upsertSummarySheet(sheet);
    results.push({ row: sheet.row, bucketKey: sheet.bucketKey, action });
  }
  return { dryRun, written: true, sheets, errors, results };
};

/**
 * `true` when a HEAD request for `url` returns 2xx; any other status, a
 * timeout or a network error counts as missing.
 *
 * @param {string} url
 * @param {(config: object) => Promise<{ status: number }>} request
 * @returns {Promise<boolean>}
 */
const fileExists = async (url, request) => {
  try {
    const response = await request({ method: 'HEAD', url, timeout: HEAD_TIMEOUT_MS, validateStatus: () => true });
    return response.status >= 200 && response.status < 300;
  } catch (_error) {
    return false;
  }
};

/**
 * HEADs every summary_sheets file at `<bucketUrl>/<bucket_key>`, a few at a
 * time.
 *
 * @param {{ bucketUrl: string, request?: Function }} options `request` defaults to axios.request.
 * @returns {Promise<{ checked: number, missing: string[] }>} `missing` lists URLs.
 */
const checkBucket = async ({ bucketUrl, request = axios.request }) => {
  const base = String(bucketUrl).replace(/\/+$/, '');
  const urls = (await selectSummarySheetKeys()).map((key) => `${base}/${encodeURI(key)}`);
  const missing = [];
  for (let i = 0; i < urls.length; i += CHECK_BATCH_SIZE) {
    const batch = urls.slice(i, i + CHECK_BATCH_SIZE);
    const found = await Promise.all(batch.map((url) => fileExists(url, request)));
    missing.push(...batch.filter((_url, index) => !found[index]));
  }
  return { checked: urls.length, missing };
};

module.exports = {
  KINDS,
  REQUIRED_COLUMNS,
  BUCKET_FOLDER,
  parseCsv,
  readInventory,
  parsePosition,
  parseInventoryRow,
  buildBucketKey,
  resolveSheet,
  planImport,
  importSummarySheets,
  checkBucket,
};
