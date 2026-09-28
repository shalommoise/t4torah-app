/**
 * Decides whether the daily send should go out for a given `dates_table` row.
 *
 * No send on Shabbos or Yom Tov. Chol HaMoed, Fridays and regular weekdays send.
 *
 * @param {{ day_of_week?: string, is_yom_tov?: boolean|number } | null | undefined} dateRow
 * @returns {boolean}
 */
const shouldSendOn = (dateRow) => {
  if (!dateRow) {
    return false;
  }
  if (dateRow.day_of_week === 'Shabbos') {
    return false;
  }
  if (dateRow.is_yom_tov) {
    return false;
  }
  return true;
};

module.exports = { shouldSendOn };
