const axios = require('axios');

// Thin wrapper over the four Mailchimp Marketing API calls the daily send
// needs. 429 and 5xx responses are retried with exponential backoff; anything
// else (4xx, network errors) fails at once with a MailchimpError.

const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_BASE_DELAY_MS = 1000;
const DEFAULT_TIMEOUT_MS = 30000;

class MailchimpError extends Error {
  /**
   * @param {string} message
   * @param {{ status?: number|null, detail?: string|null }} [fields]
   */
  constructor(message, { status = null, detail = null } = {}) {
    super(message);
    this.name = 'MailchimpError';
    this.status = status;
    this.detail = detail;
  }
}

const isRetryableStatus = (status) => status === 429 || (status >= 500 && status <= 599);

/**
 * Delay before retry number `attempt` (0-based): base, 2×base, 4×base, …
 */
const backoffDelay = (attempt, baseDelayMs) => baseDelayMs * 2 ** attempt;

const sleepMs = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Turns an axios error into a MailchimpError, using Mailchimp's
 * `{ title, detail }` problem body when there is one.
 */
const toMailchimpError = (method, path, error) => {
  const response = error && error.response;
  if (!response) {
    return new MailchimpError(`Mailchimp ${method} ${path} failed: ${(error && error.message) || error}`);
  }
  const body = response.data || {};
  const detail = body.detail || null;
  const summary = [body.title, detail].filter(Boolean).join(': ') || response.statusText || 'request failed';
  return new MailchimpError(`Mailchimp ${method} ${path} returned ${response.status}: ${summary}`, {
    status: response.status,
    detail,
  });
};

/**
 * @param {object} options
 * @param {string} options.apiKey
 * @param {string} options.serverPrefix e.g. `us21`
 * @param {(config: object) => Promise<{ data: any }>} [options.request] Defaults to axios.request.
 * @param {(ms: number) => Promise<void>} [options.sleep]
 * @param {number} [options.maxRetries=3] Retries after the first attempt.
 * @param {number} [options.baseDelayMs=1000]
 */
const createMailchimpClient = ({
  apiKey,
  serverPrefix,
  request = axios.request,
  sleep = sleepMs,
  maxRetries = DEFAULT_MAX_RETRIES,
  baseDelayMs = DEFAULT_BASE_DELAY_MS,
}) => {
  if (!apiKey || !serverPrefix) {
    throw new Error('createMailchimpClient requires apiKey and serverPrefix');
  }
  const baseURL = `https://${serverPrefix}.api.mailchimp.com/3.0`;

  const call = async (method, path, data) => {
    for (let attempt = 0; ; attempt += 1) {
      try {
        const response = await request({
          method,
          baseURL,
          url: path,
          data,
          auth: { username: 'anystring', password: apiKey },
          timeout: DEFAULT_TIMEOUT_MS,
        });
        return response.data;
      } catch (error) {
        const status = error && error.response ? error.response.status : null;
        if (attempt < maxRetries && isRetryableStatus(status)) {
          await sleep(backoffDelay(attempt, baseDelayMs));
          continue;
        }
        throw toMailchimpError(method, path, error);
      }
    }
  };

  const campaignPath = (campaignId) => `/campaigns/${encodeURIComponent(campaignId)}`;

  return {
    /** POST /campaigns → the new campaign (has `id`). */
    createCampaign: (body) => call('POST', '/campaigns', body),
    /** PUT /campaigns/{id}/content */
    setContent: (campaignId, body) => call('PUT', `${campaignPath(campaignId)}/content`, body),
    /** POST /campaigns/{id}/actions/schedule; `scheduleTime` is a Date. */
    scheduleCampaign: (campaignId, scheduleTime) =>
      call('POST', `${campaignPath(campaignId)}/actions/schedule`, {
        schedule_time: scheduleTime.toISOString(),
      }),
    /** POST /campaigns/{id}/actions/send (immediate). */
    sendCampaign: (campaignId) => call('POST', `${campaignPath(campaignId)}/actions/send`),
    /** GET /campaigns/{id} → includes `status` and `recipients.recipient_count`. */
    getCampaign: (campaignId) => call('GET', campaignPath(campaignId)),
  };
};

module.exports = { MailchimpError, createMailchimpClient, isRetryableStatus, backoffDelay };
