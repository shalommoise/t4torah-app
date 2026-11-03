const NodeID3 = require('node-id3');
const { publishDailyEpisode, getCreatedEpisodeId } = require('../src/services/castos/publishEpisodeService');

const BUCKET = 'https://storage.googleapis.com/prod_time4mishna';
const MP3 = Buffer.concat([Buffer.from([0xff, 0xfb, 0x90, 0x64]), Buffer.alloc(400)]);

const shiur = {
  shiur_type: 'regular',
  shiur_title: 'Shabbos 20.2-20.5',
  start_masechta_id: 12,
  end_masechta_id: 12,
  start_masechta_name: 'Shabbos',
  end_masechta_name: 'Shabbos',
  start_perek: 20,
  start_mishna_number: 2,
  end_perek: 20,
  end_mishna_number: 5,
};

const content = (overrides = {}) => ({
  date: { gregorian_date: '2026-11-03', day_of_week: 'Tuesday', is_yom_tov: 0, ...overrides.date },
  time4mishna: overrides.time4mishna || [shiur],
  time4nach: [],
});

const setup = ({ episodes = [], audio = MP3, now = new Date('2026-11-02T21:00:00Z') } = {}) => {
  const client = {
    listEpisodes: jest.fn().mockResolvedValue(episodes),
    createEpisode: jest.fn().mockResolvedValue({ success: true, data: { id: 777 } }),
  };
  const deps = {
    fetchAudio: jest.fn().mockResolvedValue(audio),
    fileExists: jest.fn().mockResolvedValue(true),
    getEmailExtras: jest.fn().mockResolvedValue({
      calendarUrl: `${BUCKET}/mishna/calendars/T4M-11-26.png`,
      summaryUrls: [`${BUCKET}/mishna/summaries/Shabbos-Overview.pdf`],
    }),
  };
  const options = {
    podcastId: '72963',
    client,
    now,
    timeZone: 'Europe/London',
    publishTime: '05:15',
    bucketUrl: BUCKET,
    deps,
  };
  return { client, deps, options };
};

describe('publishDailyEpisode', () => {
  test('creates the episode, scheduled for 05:15, with tagged mp3 and description', async () => {
    const { client, deps, options } = setup();

    const result = await publishDailyEpisode({ ...options, content: content(), dryRun: false });

    expect(result).toMatchObject({
      status: 'created',
      title: 'Shabbos 20.2-20.5',
      episodeId: 777,
      plan: { mode: 'schedule', post_date: '2026-11-03 05:15:00' },
      audio: { filename: 'shabbos_20.2-20.5.mp3', format: 'mp3', tagged: true },
    });
    expect(deps.fetchAudio).toHaveBeenCalledWith(`${BUCKET}/mishna/shiurim/shabbos_20.2-20.5.mp3`);
    expect(deps.fileExists).toHaveBeenCalledWith(`${BUCKET}/mishna/texts/shabbos_20.2-20.5.pdf`);
    expect(client.listEpisodes).toHaveBeenCalledWith('72963');

    const [podcastId, fields, file] = client.createEpisode.mock.calls[0];
    expect(podcastId).toBe('72963');
    expect(fields).toEqual({
      post_title: 'Shabbos 20.2-20.5',
      post_content: result.description,
      post_date: '2026-11-03 05:15:00',
    });
    expect(fields).not.toHaveProperty('episode_number');
    expect(file).toMatchObject({ filename: 'shabbos_20.2-20.5.mp3', contentType: 'audio/mpeg' });
    expect(NodeID3.read(file.buffer)).toMatchObject({ title: 'Shabbos 20.2-20.5', artist: 'Time4Mishna' });
    expect(result.description).toMatch(/Shabbos 20.2-20.5 Text/);
    expect(result.description).toMatch(/Shabbos Overview/);
    expect(result.description).toMatch(/November Calendar/);
  });

  test('at or after 05:15 on the day: no post_date (publish now)', async () => {
    const { client, options } = setup({ now: new Date('2026-11-03T05:15:00Z') });
    const result = await publishDailyEpisode({ ...options, content: content(), dryRun: false });
    expect(result.plan).toEqual({ mode: 'publish_now' });
    expect(client.createEpisode.mock.calls[0][1]).not.toHaveProperty('post_date');
  });

  test('dry run does everything except create', async () => {
    const { client, deps, options } = setup();
    const result = await publishDailyEpisode({ ...options, content: content() });
    expect(result.status).toBe('dry-run');
    expect(deps.fetchAudio).toHaveBeenCalled();
    expect(client.createEpisode).not.toHaveBeenCalled();
  });

  test('skips when an episode with the title already exists, without fetching audio', async () => {
    const { client, deps, options } = setup({ episodes: [{ id: 2689472, post_title: 'Shabbos 20.2-20.5' }] });
    const result = await publishDailyEpisode({ ...options, content: content(), dryRun: false });
    expect(result).toEqual({ status: 'exists', title: 'Shabbos 20.2-20.5', episodeId: 2689472 });
    expect(deps.fetchAudio).not.toHaveBeenCalled();
    expect(client.createEpisode).not.toHaveBeenCalled();
  });

  test.each([
    ['Shabbos', { date: { day_of_week: 'Shabbos' } }],
    ['Yom Tov', { date: { is_yom_tov: 1 } }],
    ['chazara', { time4mishna: [{ shiur_type: 'chazara', shiur_title: null }] }],
    ['no shiur', { time4mishna: [] }],
  ])('skips %s without calling Castos', async (_name, overrides) => {
    const { client, options } = setup();
    const result = await publishDailyEpisode({ ...options, content: content(overrides), dryRun: false });
    expect(result.status).toBe('skipped');
    expect(client.listEpisodes).not.toHaveBeenCalled();
  });

  test('refuses a date that has passed, before calling Castos', async () => {
    const { client, options } = setup({ now: new Date('2026-11-04T08:00:00Z') });
    await expect(publishDailyEpisode({ ...options, content: content(), dryRun: false })).rejects.toThrow(/has passed/);
    expect(client.listEpisodes).not.toHaveBeenCalled();
  });

  test('a failed fetch names the file, not the URL', async () => {
    const { deps, options } = setup();
    deps.fetchAudio.mockRejectedValue(Object.assign(new Error(`404 ${BUCKET}/x`), { response: { status: 404 } }));
    const error = await publishDailyEpisode({ ...options, content: content(), dryRun: false }).catch((e) => e);
    expect(error.message).toBe('Fetching shabbos_20.2-20.5.mp3 from the bucket failed (HTTP 404)');
    expect(error.message).not.toContain(BUCKET);
  });

  test('refuses audio that is not mp3 or m4a', async () => {
    const { client, options } = setup({ audio: Buffer.alloc(100) });
    await expect(publishDailyEpisode({ ...options, content: content(), dryRun: false })).rejects.toThrow(
      /not MP3 or M4A/
    );
    expect(client.createEpisode).not.toHaveBeenCalled();
  });

  test('text link left out when the PDF is missing', async () => {
    const { deps, options } = setup();
    deps.fileExists.mockResolvedValue(false);
    const result = await publishDailyEpisode({ ...options, content: content() });
    expect(result.description).not.toMatch(/ Text</);
  });

  test('needs a bucket URL', async () => {
    const { options } = setup();
    await expect(publishDailyEpisode({ ...options, bucketUrl: null, content: content() })).rejects.toThrow(
      /BUCKET_PATH/
    );
  });
});

describe('getCreatedEpisodeId', () => {
  test.each([
    [{ data: { id: 5 } }, 5],
    [{ data: { episode_id: 6 } }, 6],
    [{ id: 7 }, 7],
    [{ success: true }, null],
    [undefined, null],
  ])('%j → %s', (body, expected) => {
    expect(getCreatedEpisodeId(body)).toBe(expected);
  });
});
