const { createCastosClient, CastosError, buildEpisodeForm, BASE_URL } = require('../src/services/castos/client');

const API_KEY = 'secret-token-123';

const httpError = (status, data) => Object.assign(new Error(`Request failed with status code ${status}`), {
  response: { status, data, statusText: 'Error' },
});

const makeClient = (request, options = {}) =>
  createCastosClient({ apiKey: API_KEY, request, sleep: jest.fn().mockResolvedValue(), ...options });

describe('createCastosClient', () => {
  test('requires an api key', () => {
    expect(() => createCastosClient({})).toThrow(/apiKey/);
  });

  test('sends the token as a bearer header, never in the URL', async () => {
    const request = jest.fn().mockResolvedValue({ data: { data: [] } });
    await makeClient(request).listEpisodes('72963');

    const config = request.mock.calls[0][0];
    expect(config).toMatchObject({
      method: 'GET',
      baseURL: BASE_URL,
      url: '/podcasts/72963/episodes',
      headers: { Authorization: `Bearer ${API_KEY}` },
    });
    expect(config.url).not.toMatch(/token/);
    expect(config.params).toBeUndefined();
  });

  test('listEpisodes returns the data array, or [] for anything else', async () => {
    const episodes = [{ id: 1, post_title: 'Shabbos 20.2-20.5' }];
    await expect(makeClient(jest.fn().mockResolvedValue({ data: { data: episodes } })).listEpisodes('1')).resolves.toBe(
      episodes
    );
    await expect(makeClient(jest.fn().mockResolvedValue({ data: {} })).listEpisodes('1')).resolves.toEqual([]);
  });

  test('listPodcasts returns the podcast_list map', async () => {
    const request = jest.fn().mockResolvedValue({ data: { data: { podcast_list: { 72963: 'Test' } } } });
    await expect(makeClient(request).listPodcasts()).resolves.toEqual({ 72963: 'Test' });
  });

  test('createEpisode posts multipart form data with the audio file', async () => {
    const request = jest.fn().mockResolvedValue({ data: { success: true, data: { id: 9 } } });
    const file = { buffer: Buffer.from('ID3audio'), filename: 'shabbos_20.2-20.5.mp3', contentType: 'audio/mpeg' };

    await expect(
      makeClient(request).createEpisode('72963', { post_title: 'T', post_content: '<p>x</p>', post_date: undefined }, file)
    ).resolves.toEqual({ success: true, data: { id: 9 } });

    const config = request.mock.calls[0][0];
    expect(config).toMatchObject({ method: 'POST', url: '/podcasts/72963/episodes' });
    expect(config.data).toBeInstanceOf(FormData);
    expect(config.data.get('post_title')).toBe('T');
    expect(config.data.has('post_date')).toBe(false);
    const upload = config.data.get('episode_file');
    expect(upload.name).toBe('shabbos_20.2-20.5.mp3');
    expect(upload.type).toBe('audio/mpeg');
    expect(Buffer.from(await upload.arrayBuffer()).toString()).toBe('ID3audio');
  });

  test('updateEpisode posts the fields to the episode', async () => {
    const request = jest.fn().mockResolvedValue({ data: { success: true } });
    await makeClient(request).updateEpisode('72963', 55, { updated_episode_file: 'https://example.org/a.mp3' });
    const config = request.mock.calls[0][0];
    expect(config.url).toBe('/podcasts/72963/episodes/55');
    expect(config.data.get('updated_episode_file')).toBe('https://example.org/a.mp3');
  });

  test('GET retries 429 and 5xx with backoff', async () => {
    const sleep = jest.fn().mockResolvedValue();
    const request = jest
      .fn()
      .mockRejectedValueOnce(httpError(503))
      .mockRejectedValueOnce(httpError(429))
      .mockResolvedValue({ data: { data: [] } });

    await makeClient(request, { sleep }).listEpisodes('1');
    expect(request).toHaveBeenCalledTimes(3);
    expect(sleep.mock.calls).toEqual([[1000], [2000]]);
  });

  test('create is not retried on 5xx (it may have been created)', async () => {
    const request = jest.fn().mockRejectedValue(httpError(502, { message: 'Bad gateway' }));
    await expect(makeClient(request).createEpisode('1', { post_title: 'T' })).rejects.toThrow(
      'Castos POST /podcasts/1/episodes returned 502: Bad gateway'
    );
    expect(request).toHaveBeenCalledTimes(1);
  });

  test('create is retried on 429', async () => {
    const request = jest.fn().mockRejectedValueOnce(httpError(429)).mockResolvedValue({ data: { data: { id: 1 } } });
    await makeClient(request).createEpisode('1', { post_title: 'T' });
    expect(request).toHaveBeenCalledTimes(2);
  });

  test('4xx fails at once with a CastosError including field errors', async () => {
    const request = jest
      .fn()
      .mockRejectedValue(httpError(422, { message: 'Invalid', errors: { episode_file: ['required'] } }));
    const error = await makeClient(request).createEpisode('1', {}).catch((e) => e);
    expect(error).toBeInstanceOf(CastosError);
    expect(error.status).toBe(422);
    expect(error.message).toBe('Castos POST /podcasts/1/episodes returned 422: Invalid {"episode_file":["required"]}');
  });

  test('never puts the token in an error message', async () => {
    const network = jest.fn().mockRejectedValue(new Error(`connect failed Bearer ${API_KEY}`));
    const networkError = await makeClient(network, { maxRetries: 0 }).listEpisodes('1').catch((e) => e);
    expect(networkError.message).not.toContain(API_KEY);
    expect(networkError.message).toContain('[redacted]');

    const echoed = jest.fn().mockRejectedValue(httpError(401, { message: `bad token ${API_KEY}` }));
    const httpErr = await makeClient(echoed).listEpisodes('1').catch((e) => e);
    expect(httpErr.message).not.toContain(API_KEY);
    expect(httpErr.detail).not.toContain(API_KEY);
  });

  test('encodes path ids', async () => {
    const request = jest.fn().mockResolvedValue({ data: { data: {} } });
    await makeClient(request).getEpisode('1/2', 'a b');
    expect(request.mock.calls[0][0].url).toBe('/podcasts/1%2F2/episodes/a%20b');
  });
});

describe('buildEpisodeForm', () => {
  test('skips null and undefined fields and stringifies numbers', () => {
    const form = buildEpisodeForm({ a: 1, b: null, c: undefined, d: 'x' });
    expect([...form.keys()]).toEqual(['a', 'd']);
    expect(form.get('a')).toBe('1');
  });
});
