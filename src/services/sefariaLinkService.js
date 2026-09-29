const masechtaNames = require('../../db/data/masechtaNames.json');
const mishnaIndex = require('../../db/data/mishnaIndex.json');
const chapterIndex = require('../../db/data/chapterIndex.json');
const tanachIndex = require('../../db/data/tanach_index.json');
const { parseShiurTitle } = require('../../utils/utils');

const SEFARIA_BASE_URL = 'https://www.sefaria.org';

// masechta_table ids follow masechtaNames.json order (see db/fillMasechtaIntoTable.js),
// and mishnaIndex.json's masechtaNameAlt is the Sefaria title that
// SefariaUtils/getmishnayos.js used to fetch the texts.
const masechtaInfoByName = new Map(
  masechtaNames.map(([name], index) => {
    const info = mishnaIndex.find((row) => row.masechtaId === index + 1);
    return [name, info];
  })
);

// tanach_index.json alt_name uses "1 Samuel"; Sefaria uses "I Samuel".
const toSefariaSeferTitle = (altName) =>
  altName.replace(/^1 /, 'I ').replace(/^2 /, 'II ');

const seferTitleByName = new Map(
  tanachIndex.map((sefer) => [sefer.english, toSefariaSeferTitle(sefer.alt_name)])
);

const toUrlSegment = (title) => title.replace(/ /g, '_');

/**
 * Sefaria title for a masechta name as stored in masechta_table
 * (e.g. `Brachos` → `Berakhot`), or `null` if unknown.
 *
 * @param {string} masechtaName
 * @returns {string|null}
 */
const getSefariaMasechtaTitle = (masechtaName) => {
  const info = masechtaInfoByName.get(masechtaName);
  return info ? info.masechtaNameAlt : null;
};

/**
 * Sefaria title for a sefer name as stored in tanach_table
 * (e.g. `Shmuel Aleph` → `I Samuel`), or `null` if unknown.
 *
 * @param {string} seferName
 * @returns {string|null}
 */
const getSefariaSeferTitle = (seferName) => seferTitleByName.get(seferName) || null;

/**
 * Sefaria URL for a Mishna range within one masechta, e.g.
 * `https://www.sefaria.org/Mishnah_Berakhot.1.1-4` or `...Mishnah_Berakhot.1.5-2.3`.
 *
 * @param {{ masechta: string, startPerek: number, startMishna: number, endPerek: number, endMishna: number }} range
 *   `masechta` is the masechta_table name (e.g. `Brachos`).
 * @returns {string|null} `null` for an unknown masechta.
 */
const buildMishnaRangeUrl = ({ masechta, startPerek, startMishna, endPerek, endMishna }) => {
  const title = getSefariaMasechtaTitle(masechta);
  if (!title) {
    return null;
  }

  let ref = `${startPerek}.${startMishna}`;
  if (startPerek !== endPerek) {
    ref += `-${endPerek}.${endMishna}`;
  } else if (startMishna !== endMishna) {
    ref += `-${endMishna}`;
  }
  return `${SEFARIA_BASE_URL}/Mishnah_${toUrlSegment(title)}.${ref}`;
};

const getLastMishnaOfMasechta = (masechtaName) => {
  const info = masechtaInfoByName.get(masechtaName);
  if (!info) {
    return null;
  }
  const lastChapter = chapterIndex.find(
    (row) => row.masechtaId === info.masechtaId && row.chapter === info.perakimNumber
  );
  if (!lastChapter) {
    return null;
  }
  return { perek: info.perakimNumber, mishna: lastChapter.numOfMishnyosInTexts };
};

const getMishnaRange = (scheduleRow) => {
  if (
    scheduleRow.start_masechta_name &&
    scheduleRow.end_masechta_name &&
    scheduleRow.start_perek != null &&
    scheduleRow.start_mishna_number != null &&
    scheduleRow.end_perek != null &&
    scheduleRow.end_mishna_number != null
  ) {
    return {
      startMasechta: scheduleRow.start_masechta_name,
      startPerek: scheduleRow.start_perek,
      startMishna: scheduleRow.start_mishna_number,
      endMasechta: scheduleRow.end_masechta_name,
      endPerek: scheduleRow.end_perek,
      endMishna: scheduleRow.end_mishna_number,
    };
  }

  const parsed = parseShiurTitle(scheduleRow.shiur_title);
  if (!parsed) {
    return null;
  }
  return {
    startMasechta: parsed.firstMasechta,
    startPerek: parsed.firstPerek,
    startMishna: parsed.firstMishna,
    endMasechta: parsed.lastMasechta,
    endPerek: parsed.lastPerek,
    endMishna: parsed.lastMishna,
  };
};

/**
 * Sefaria links for a `selectTime4MishnaScheduleByDateId` row.
 *
 * Returns one URL for a single-masechta shiur. Sefaria refs can't span two
 * masechtos, so a cross-masechta shiur returns two URLs: the start masechta
 * to its last mishna, then the end masechta from 1:1.
 *
 * Returns `[]` for a no-shiur day, a non-regular (chazara) shiur, or when the
 * masechta can't be mapped to a Sefaria title.
 *
 * @param {object|null|undefined} scheduleRow
 * @returns {string[]}
 */
const buildMishnaSefariaLinks = (scheduleRow) => {
  if (!scheduleRow || scheduleRow.shiur_type !== 'regular') {
    return [];
  }
  const range = getMishnaRange(scheduleRow);
  if (!range) {
    return [];
  }

  if (range.startMasechta === range.endMasechta) {
    const url = buildMishnaRangeUrl({
      masechta: range.startMasechta,
      startPerek: range.startPerek,
      startMishna: range.startMishna,
      endPerek: range.endPerek,
      endMishna: range.endMishna,
    });
    return url ? [url] : [];
  }

  const startMasechtaEnd = getLastMishnaOfMasechta(range.startMasechta);
  if (!startMasechtaEnd) {
    return [];
  }
  const urls = [
    buildMishnaRangeUrl({
      masechta: range.startMasechta,
      startPerek: range.startPerek,
      startMishna: range.startMishna,
      endPerek: startMasechtaEnd.perek,
      endMishna: startMasechtaEnd.mishna,
    }),
    buildMishnaRangeUrl({
      masechta: range.endMasechta,
      startPerek: 1,
      startMishna: 1,
      endPerek: range.endPerek,
      endMishna: range.endMishna,
    }),
  ];
  return urls.every(Boolean) ? urls : [];
};

/**
 * Sefaria link for a `selectTime4NachScheduleByDateId` row, e.g.
 * `https://www.sefaria.org/I_Samuel.3`.
 *
 * Returns `null` for a no-shiur day, a non-regular shiur, missing data, or
 * an unknown sefer.
 *
 * @param {object|null|undefined} scheduleRow
 * @returns {string|null}
 */
const buildNachSefariaLink = (scheduleRow) => {
  if (!scheduleRow || scheduleRow.shiur_type !== 'regular' || scheduleRow.perek == null) {
    return null;
  }
  const title = getSefariaSeferTitle(scheduleRow.sefer_name);
  if (!title) {
    return null;
  }
  return `${SEFARIA_BASE_URL}/${toUrlSegment(title)}.${scheduleRow.perek}`;
};

module.exports = {
  SEFARIA_BASE_URL,
  getSefariaMasechtaTitle,
  getSefariaSeferTitle,
  buildMishnaRangeUrl,
  buildMishnaSefariaLinks,
  buildNachSefariaLink,
};
