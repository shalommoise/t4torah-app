const axios = require('axios');

// Thin wrapper over the Castos API v2 calls the episode job needs, shaped like
// ../mailchimp/client.js. Auth is a bearer header (never the ?token= query
// parameter), and error messages never include the token.
//
// Reads (GET) retry 429 and 5xx with exponential backoff. Writes retry only
// 429: a 5xx on a create may still have created the episode, and retrying it
// could publish a duplicate.

const BASE_URL = 'https://app.castos.com/api/v2';
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_BASE_DELAY_MS = 1000;
const DEFAULT_TIMEOUT_MS = 30000;
// Uploads carry a ~7 MB mp3.
const UPLOAD_TIMEOUT_MS = 5 * 60 * 1000;
const MAX_DETAIL_LENGTH = 300;

class CastosError extends Error {
  /**
   * @param {string} message
   * @param {{ status?: number|null, detail?: string|null }} [fields]
   */
  constructor(message, { status = null, detail = null } = {}) {
    super(message);
    this.name = 'CastosError';
    this.status = status;
    this.detail = detail;
  }
}

const isRetryableStatus = (status) => status === 429 || (status >= 500 && status <= 599);
const isRateLimited = (status) => status === 429;

/** Delay before retry number `attempt` (0-based): base, 2×base, 4×base, … */
const backoffDelay = (attempt, baseDelayMs) => baseDelayMs * 2 ** attempt;

const sleepMs = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Castos's error text: `message`, plus field `errors` when it sends them. */
const describeBody = (body) => {
  if (!body || typeof body !== 'object') {
    return typeof body === 'string' ? body : '';
  }
  const parts = [body.message, body.errors && JSON.stringify(body.errors)].filter(Boolean);
  return parts.join(' ');
};

const truncate = (text) => (text.length > MAX_DETAIL_LENGTH ? `${text.slice(0, MAX_DETAIL_LENGTH)}…` : text);

/** Removes every occurrence of `secret` from `text`. */
const redact = (text, secret) => (secret ? String(text).split(secret).join('[redacted]') : String(text));

const toCastosError = (method, path, error, apiKey) => {
  const response = error && error.response;
  if (!response) {
    const reason = redact((error && error.message) || error, apiKey);
    return new CastosError(`Castos ${method} ${path} failed: ${reason}`);
  }
  const detail = truncate(redact(describeBody(response.data), apiKey)) || null;
  const summary = detail || response.statusText || 'request failed';
  return new CastosError(`Castos ${method} ${path} returned ${response.status}: ${summary}`, {
    status: response.status,
    detail,
  });
};

/**
 * Builds the multipart body for a create or update. `file` (optional) is the
 * audio itself; every other field is sent as text.
 *
 * @param {Record<string, string|number|null|undefined>} fields
 * @param {{ buffer: Buffer, filename: string, contentType: string }} [file]
 * @param {string} [fileField='episode_file']
 * @returns {FormData}
 */
const buildEpisodeForm = (fields, file, fileField = 'episode_file') => {
  const form = new FormData();
  for (const [name, value] of Object.entries(fields)) {
    if (value !== undefined && value !== null) {
      form.append(name, String(value));
    }
  }
  if (file) {
    form.append(fileField, new Blob([file.buffer], { type: file.contentType }), file.filename);
  }
  return form;
};

/**
 * @param {object} options
 * @param {string} options.apiKey CASTOS_API_KEY
 * @param {(config: object) => Promise<{ data: any }>} [options.request] Defaults to axios.request.
 * @param {(ms: number) => Promise<void>} [options.sleep]
 * @param {number} [options.maxRetries=3] Retries after the first attempt.
 * @param {number} [options.baseDelayMs=1000]
 */
const createCastosClient = ({
  apiKey,
  request = axios.request,
  sleep = sleepMs,
  maxRetries = DEFAULT_MAX_RETRIES,
  baseDelayMs = DEFAULT_BASE_DELAY_MS,
}) => {
  if (!apiKey) {
    throw new Error('createCastosClient requires apiKey');
  }

  const call = async (method, path, { data, timeout = DEFAULT_TIMEOUT_MS } = {}) => {
    const shouldRetry = method === 'GET' ? isRetryableStatus : isRateLimited;
    for (let attempt = 0; ; attempt += 1) {
      try {
        const response = await request({
          method,
          baseURL: BASE_URL,
          url: path,
          data,
          headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' },
          timeout,
          maxBodyLength: Infinity,
          maxContentLength: Infinity,
        });
        return response.data;
      } catch (error) {
        const status = error && error.response ? error.response.status : null;
        if (attempt < maxRetries && shouldRetry(status)) {
          await sleep(backoffDelay(attempt, baseDelayMs));
          continue;
        }
        throw toCastosError(method, path, error, apiKey);
      }
    }
  };

  const episodesPath = (podcastId) => `/podcasts/${encodeURIComponent(podcastId)}/episodes`;

  return {
    /** GET /podcasts → `data.podcast_list`, an `{ id: title }` map. */
    listPodcasts: async () => {
      const body = await call('GET', '/podcasts');
      return (body && body.data && body.data.podcast_list) || {};
    },
    /** GET /podcasts/{id}/episodes → the episodes (`id`, `post_title`, `post_date`, …). */
    listEpisodes: async (podcastId) => {
      const body = await call('GET', episodesPath(podcastId));
      const data = body && body.data;
      return Array.isArray(data) ? data : [];
    },
    /** GET /podcasts/{id}/episodes/{episodeId} → the episode, with `file` and `episode_status_id`. */
    getEpisode: async (podcastId, episodeId) => {
      const body = await call('GET', `${episodesPath(podcastId)}/${encodeURIComponent(episodeId)}`);
      return body && body.data;
    },
    /**
     * POST /podcasts/{id}/episodes as multipart/form-data. Returns the whole
     * response body, since the spec doesn't say what it contains.
     *
     * @param {string} podcastId
     * @param {Record<string, string|number|null|undefined>} fields post_title, post_content, post_date, …
     * @param {{ buffer: Buffer, filename: string, contentType: string }} [file] the audio; omit to send episode_file as a field
     */
    createEpisode: (podcastId, fields, file) =>
      call('POST', episodesPath(podcastId), { data: buildEpisodeForm(fields, file), timeout: UPLOAD_TIMEOUT_MS }),
    /** POST /podcasts/{id}/episodes/{episodeId}; replace audio with `updated_episode_file` (a URL). */
    updateEpisode: (podcastId, episodeId, fields) =>
      call('POST', `${episodesPath(podcastId)}/${encodeURIComponent(episodeId)}`, {
        data: buildEpisodeForm(fields),
        timeout: UPLOAD_TIMEOUT_MS,
      }),
  };
};

module.exports = {
  BASE_URL,
  CastosError,
  createCastosClient,
  buildEpisodeForm,
  isRetryableStatus,
  backoffDelay,
};
