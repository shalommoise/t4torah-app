const { parseShiurTitle } = require('../../utils/utils');

/**
 * Builds a Mishna range label (e.g. `Brachos 1:1–1:4`, or across masechtos
 * `Brachos 9:5 – Peah 1:3`) from a `selectTime4MishnaScheduleByDateId` row.
 *
 * Returns `null` on a no-shiur day (no schedule row) or when there isn't
 * enough data to build a label. Returns `'Chazara'` for non-regular shiurim,
 * matching the convention used in `calendarService.normalizeShiur`.
 *
 * @param {object|null|undefined} scheduleRow
 * @returns {string|null}
 */
const formatMishnaShiurLabel = (scheduleRow) => {
  if (!scheduleRow) {
    return null;
  }
  if (scheduleRow.shiur_type !== 'regular') {
    return 'Chazara';
  }

  if (
    scheduleRow.start_masechta_name &&
    scheduleRow.end_masechta_name &&
    scheduleRow.start_perek != null &&
    scheduleRow.start_mishna_number != null &&
    scheduleRow.end_perek != null &&
    scheduleRow.end_mishna_number != null
  ) {
    const start = `${scheduleRow.start_perek}:${scheduleRow.start_mishna_number}`;
    const end = `${scheduleRow.end_perek}:${scheduleRow.end_mishna_number}`;

    if (scheduleRow.start_masechta_id === scheduleRow.end_masechta_id) {
      return `${scheduleRow.start_masechta_name} ${start}–${end}`;
    }
    return `${scheduleRow.start_masechta_name} ${start} – ${scheduleRow.end_masechta_name} ${end}`;
  }

  // Fall back to parsing the raw shiur_title (e.g. "Brachos 1:1-1:4") when the
  // joined masechta/perek/mishna fields aren't available.
  const parsed = parseShiurTitle(scheduleRow.shiur_title);
  if (!parsed) {
    return null;
  }

  const start = `${parsed.firstPerek}:${parsed.firstMishna}`;
  const end = `${parsed.lastPerek}:${parsed.lastMishna}`;
  if (parsed.firstMasechta === parsed.lastMasechta) {
    return `${parsed.firstMasechta} ${start}–${end}`;
  }
  return `${parsed.firstMasechta} ${start} – ${parsed.lastMasechta} ${end}`;
};

/**
 * Builds a Nach label (e.g. `Tehillim 42`) from a
 * `selectTime4NachScheduleByDateId` row.
 *
 * Returns `null` on a no-shiur day or missing data, `'Chazara'` for
 * non-regular shiurim.
 *
 * @param {object|null|undefined} scheduleRow
 * @returns {string|null}
 */
const formatNachShiurLabel = (scheduleRow) => {
  if (!scheduleRow) {
    return null;
  }
  if (scheduleRow.shiur_type !== 'regular') {
    return 'Chazara';
  }
  if (!scheduleRow.sefer_name || scheduleRow.perek == null) {
    return null;
  }
  return `${scheduleRow.sefer_name} ${scheduleRow.perek}`;
};

/**
 * Returns the daily_schedule row's additional_notice, or `null` when there
 * isn't one.
 *
 * @param {object|null|undefined} scheduleRow
 * @returns {string|null}
 */
const getAdditionalNotice = (scheduleRow) => {
  if (!scheduleRow || !scheduleRow.additional_notice) {
    return null;
  }
  return scheduleRow.additional_notice;
};

module.exports = { formatMishnaShiurLabel, formatNachShiurLabel, getAdditionalNotice };
