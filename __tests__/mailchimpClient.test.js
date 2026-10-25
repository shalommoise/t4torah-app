const {
  MailchimpError,
  createMailchimpClient,
  isRetryableStatus,
  backoffDelay,
} = require('../src/services/mailchimp/client');

const httpError = (status, data = {}) => Object.assign(new Error(`HTTP ${status}`), { response: { status, data } });

const makeClient = (request, overrides) => {
  const sleep = jest.fn().mockResolvedValue();
  const client = createMailchimpClient({ apiKey: 'key-us21', serverPrefix: 'us21', request, sleep, ...overrides });
  return { client, sleep };
};

describe('requests', () => {
  test('each endpoint uses the right method, path and body, with basic auth', async () => {
    const request = jest.fn().mockResolvedValue({ data: { id: 'c1' } });
    const { client } = makeClient(request);

    await expect(client.createCampaign({ type: 'regular' })).resolves.toEqual({ id: 'c1' });
    await client.setContent('c1', { html: '<p>h</p>' });
    await client.scheduleCampaign('c1', new Date('2026-10-19T04:15:00Z'));
    await client.sendCampaign('c1');
    await client.getCampaign('c1');

    expect(request.mock.calls.map(([config]) => [config.method, config.url, config.data])).toEqual([
      ['POST', '/campaigns', { type: 'regular' }],
      ['PUT', '/campaigns/c1/content', { html: '<p>h</p>' }],
      ['POST', '/campaigns/c1/actions/schedule', { schedule_time: '2026-10-19T04:15:00.000Z' }],
      ['POST', '/campaigns/c1/actions/send', undefined],
      ['GET', '/campaigns/c1', undefined],
    ]);
    request.mock.calls.forEach(([config]) => {
      expect(config.baseURL).toBe('https://us21.api.mailchimp.com/3.0');
      expect(config.auth).toEqual({ username: 'anystring', password: 'key-us21' });
    });
  });

  test('encodes the campaign id in the path', async () => {
    const request = jest.fn().mockResolvedValue({ data: {} });
    const { client } = makeClient(request);
    await client.getCampaign('a/b');
    expect(request.mock.calls[0][0].url).toBe('/campaigns/a%2Fb');
  });

  test('requires an api key and server prefix', () => {
    expect(() => createMailchimpClient({ apiKey: '', serverPrefix: 'us21' })).toThrow('requires apiKey');
  });
});

describe('retry', () => {
  test.each([429, 500, 503])('retries %d with exponential backoff, then succeeds', async (status) => {
    const request = jest
      .fn()
      .mockRejectedValueOnce(httpError(status))
      .mockRejectedValueOnce(httpError(status))
      .mockResolvedValue({ data: { id: 'c1' } });
    const { client, sleep } = makeClient(request, { baseDelayMs: 100 });

    await expect(client.createCampaign({})).resolves.toEqual({ id: 'c1' });
    expect(request).toHaveBeenCalledTimes(3);
    expect(sleep.mock.calls).toEqual([[100], [200]]);
  });

  test('gives up after maxRetries and reports the last error', async () => {
    const request = jest.fn().mockRejectedValue(httpError(502, { title: 'Bad Gateway' }));
    const { client, sleep } = makeClient(request, { maxRetries: 2 });

    const error = await client.getCampaign('c1').catch((e) => e);
    expect(error).toBeInstanceOf(MailchimpError);
    expect(error.status).toBe(502);
    expect(error.message).toBe('Mailchimp GET /campaigns/c1 returned 502: Bad Gateway');
    expect(request).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenCalledTimes(2);
  });

  test.each([400, 401, 404])('does not retry %d', async (status) => {
    const request = jest
      .fn()
      .mockRejectedValue(httpError(status, { title: 'Invalid Resource', detail: 'The resource submitted could not be validated.' }));
    const { client, sleep } = makeClient(request);

    const error = await client.createCampaign({}).catch((e) => e);
    expect(error).toMatchObject({
      name: 'MailchimpError',
      status,
      detail: 'The resource submitted could not be validated.',
    });
    expect(error.message).toBe(
      `Mailchimp POST /campaigns returned ${status}: Invalid Resource: The resource submitted could not be validated.`
    );
    expect(request).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  test('does not retry a network error (no response)', async () => {
    const request = jest.fn().mockRejectedValue(new Error('ECONNRESET'));
    const { client, sleep } = makeClient(request);

    const error = await client.sendCampaign('c1').catch((e) => e);
    expect(error).toMatchObject({ name: 'MailchimpError', status: null });
    expect(error.message).toBe('Mailchimp POST /campaigns/c1/actions/send failed: ECONNRESET');
    expect(request).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });
});

describe('helpers', () => {
  test('isRetryableStatus covers 429 and 5xx only', () => {
    expect([429, 500, 599].map(isRetryableStatus)).toEqual([true, true, true]);
    expect([null, 200, 400, 404, 600].map(isRetryableStatus)).toEqual([false, false, false, false, false]);
  });

  test('backoffDelay doubles each attempt', () => {
    expect([0, 1, 2].map((attempt) => backoffDelay(attempt, 1000))).toEqual([1000, 2000, 4000]);
  });
});
