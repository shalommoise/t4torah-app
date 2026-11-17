const { findEpisodeAudioUrl, waitForEpisodeAudioUrl, verifyAudioUrl } = require('../src/services/castos/episodeFile');

const URL = 'https://episodes.castos.com/time4tefilla/877-which-good-years.mp3';
const noSleep = () => Promise.resolve();

describe('findEpisodeAudioUrl', () => {
  test.each([
    ['top-level file string', { success: true, file: URL }],
    ['file.url', { episode: { id: 1 }, file: { url: URL } }],
    ['file.file_path', { file: { file_name: 'x.mp3', file_path: URL } }],
    ['episode.audio_url', { episode: { id: 1, audio_url: URL } }],
    ['data.file.file_url (GET episode)', { data: { id: 1, file: { file_url: URL } } }],
    ['GET episode data, unwrapped', { id: 1, file: { url: URL } }],
    ['an unknown field, found by search', { episode: { media: { stream: { href: URL } } } }],
    ['with a query string', { file: { url: `${URL}?v=2` } }],
  ])('%s', (_name, body) => {
    expect(findEpisodeAudioUrl(body)).toMatch(/^https:\/\/episodes\.castos\.com\/time4tefilla\/877-which-good-years\.mp3/);
  });

  test.each([
    ['nothing', null],
    ['no URL', { episode: { id: 1 }, file: { file_name: 'x.mp3', import_status: 'processing' } }],
    ['http, not https', { file: { url: 'http://episodes.castos.com/x.mp3' } }],
    ['an image URL', { episode: { image: 'https://cdn.castos.com/cover.jpg' } }],
  ])('null for %s', (_name, body) => {
    expect(findEpisodeAudioUrl(body)).toBeNull();
  });
});

describe('waitForEpisodeAudioUrl', () => {
  test('reads the episode until the URL appears', async () => {
    const client = {
      getEpisode: jest
        .fn()
        .mockResolvedValueOnce({ id: 9, file: { import_status: 'processing' } })
        .mockResolvedValueOnce({ id: 9, file: { url: URL } }),
    };
    const sleep = jest.fn(noSleep);
    await expect(waitForEpisodeAudioUrl({ client, podcastId: '300', episodeId: 9, sleep, intervalMs: 7 })).resolves.toMatchObject({ url: URL });
    expect(client.getEpisode).toHaveBeenCalledWith('300', 9);
    expect(sleep).toHaveBeenCalledWith(7);
  });

  test('gives up with the import status', async () => {
    const client = { getEpisode: jest.fn().mockResolvedValue({ id: 9, file: { import_status: 'failed' } }) };
    await expect(waitForEpisodeAudioUrl({ client, podcastId: '300', episodeId: 9, sleep: noSleep, attempts: 3 })).rejects.toThrow(
      'Castos episode 9 has no audio URL after 3 check(s) (file import_status: failed)'
    );
    expect(client.getEpisode).toHaveBeenCalledTimes(3);
  });
});

describe('verifyAudioUrl', () => {
  const response = (status) => Promise.resolve({ status });

  test('a HEAD 200 passes at once', async () => {
    const request = jest.fn(() => response(200));
    await expect(verifyAudioUrl(URL, { request, sleep: noSleep })).resolves.toEqual({ url: URL, checks: 1 });
    expect(request).toHaveBeenCalledWith(expect.objectContaining({ method: 'HEAD', url: URL, maxRedirects: 5 }));
  });

  test('polls until the URL returns 200', async () => {
    const request = jest.fn().mockReturnValueOnce(response(404)).mockReturnValueOnce(Promise.reject(new Error('ECONNRESET'))).mockReturnValue(response(200));
    const sleep = jest.fn(noSleep);
    await expect(verifyAudioUrl(URL, { request, sleep, intervalMs: 3 })).resolves.toEqual({ url: URL, checks: 3 });
    expect(sleep).toHaveBeenCalledTimes(2);
  });

  test('falls back to a ranged GET when HEAD is refused (206 counts as 200)', async () => {
    const request = jest.fn((config) => response(config.method === 'HEAD' ? 405 : 206));
    await expect(verifyAudioUrl(URL, { request, sleep: noSleep })).resolves.toEqual({ url: URL, checks: 1 });
    expect(request).toHaveBeenLastCalledWith(expect.objectContaining({ method: 'GET', headers: { Range: 'bytes=0-1023' } }));
  });

  test('fails clearly when it never returns 200', async () => {
    const request = jest.fn(() => response(403));
    await expect(verifyAudioUrl(URL, { request, sleep: noSleep, attempts: 2 })).rejects.toThrow(
      `The episode audio ${URL} did not return 200 after 2 check(s) (last: HTTP 403)`
    );
  });

  test('refuses something that is not an https audio URL', async () => {
    const request = jest.fn();
    await expect(verifyAudioUrl('http://example.org/a.mp3', { request })).rejects.toThrow('Not an https audio URL');
    expect(request).not.toHaveBeenCalled();
  });
});
