const axios = require('axios');
const { getCalendarUrl, getSummaryLinks } = require('./render/emailLinks');

const HEAD_TIMEOUT_MS = 5000;

/** No calendar and no summaries: what the email shows when nothing is found. */
const NO_EXTRAS = Object.freeze({ calendarUrl: null, summaryUrls: [] });

/**
 * `true` when a HEAD request for `url` returns 2xx. Any other status, a
 * timeout or a network error counts as missing, so a send never fails
 * because of an optional file.
 *
 * @param {string} url
 * @param {(config: object) => Promise<{ status: number }>} [request] Defaults to axios.request.
 * @returns {Promise<boolean>}
 */
const fileExists = async (url, request = axios.request) => {
  try {
    const response = await request({
      method: 'HEAD',
      url,
      timeout: HEAD_TIMEOUT_MS,
      validateStatus: () => true,
    });
    return response.status >= 200 && response.status < 300;
  } catch (_error) {
    return false;
  }
};

/**
 * Finds the optional email files that are in the bucket for a day: the
 * month's calendar image and each Time4Mishna masechta's Overview and Key
 * Terms PDFs. Files that aren't there are left out of the email.
 *
 * @param {{ date: object, time4mishna: object[] }} content getDailyContent output.
 * @param {{ bucketUrl: string|null }} emailConfig
 * @param {{ request?: (config: object) => Promise<{ status: number }> }} [options]
 * @returns {Promise<{ calendarUrl: string|null, summaryUrls: string[] }>}
 *   `summaryUrls` lists the summary PDFs that exist.
 */
const getEmailExtras = async (content, { bucketUrl }, { request } = {}) => {
  if (!bucketUrl || !content || !content.date) {
    return NO_EXTRAS;
  }
  const calendarUrl = getCalendarUrl(content.date.gregorian_date, bucketUrl);
  const summaryUrls = [
    ...new Set((content.time4mishna || []).flatMap((row) => getSummaryLinks(row, bucketUrl).map((link) => link.url))),
  ];

  const [calendarFound, ...summariesFound] = await Promise.all(
    [calendarUrl, ...summaryUrls].map((url) => (url ? fileExists(url, request) : false))
  );
  return {
    calendarUrl: calendarFound ? calendarUrl : null,
    summaryUrls: summaryUrls.filter((_url, index) => summariesFound[index]),
  };
};

module.exports = { NO_EXTRAS, fileExists, getEmailExtras };
