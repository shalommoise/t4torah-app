const NodeID3 = require('node-id3');
const { runTefillaPipeline } = require('../src/services/tefilla/pipeline');
const { CastosError } = require('../src/services/castos/client');

// A minimal MPEG-1 Layer III frame header followed by padding: what the mocked ffmpeg "produces".
const mp3 = () => Buffer.concat([Buffer.from([0xff, 0xfb, 0x90, 0x64]), Buffer.alloc(400)]);
const voiceNote = () => Buffer.concat([Buffer.from('OggS'), Buffer.alloc(100)]);

const TITLE = '877.  Which ‘Good Years’ Do We Refer To?';
const CLEAN_TITLE = '877. Which ‘Good Years’ Do We Refer To?';
const AUDIO_URL = 'https://episodes.castos.com/time4tefilla/877-which-good-years.mp3';

// November: London is on GMT, so 05:15 London = 05:15Z.
const BEFORE = new Date('2026-11-17T03:00:00Z');
const AFTER = new Date('2026-11-17T09:30:00Z');
const JUST_BEFORE = new Date('2026-11-17T05:12:00Z');
const EVENING = new Date('2026-11-17T22:28:00Z');

const mailchimp = {
  apiKey: 'key-us21',
  serverPrefix: 'us21',
  audienceId: 'tefilla-list',
  fromName: 'Time4Tefilla',
  replyTo: 'tefilla@time4torah.org',
  sendTime: '05:15',
  sendTimeZone: 'Europe/London',
};

const config = (mode = 'live', overrides = {}) => ({
  mode,
  timeZone: 'Europe/London',
  publishTime: '05:15',
  sendTime: '05:15',
  nextDayAfter: '16:00',
  outboxDir: 'outbox-test',
  castos: mode === 'dry-run' ? null : { apiKey: 'castos-key', podcastId: mode === 'live' ? '300' : '100' },
  mailchimp: mode === 'dry-run' ? null : { ...mailchimp, audienceId: mode === 'live' ? 'tefilla-list' : 'test-list' },
  ...overrides,
});

const makeDeps = ({ now = BEFORE, createResponse, episodes = [], claim = true, row = null, reclaim = false } = {}) => {
  const lines = [];
  const castosClient = {
    listEpisodes: jest.fn().mockResolvedValue(episodes),
    createEpisode: jest
      .fn()
      .mockResolvedValue(createResponse || { success: true, episode: { id: 555 }, file: { url: AUDIO_URL, file_name: 'x.mp3' } }),
    getEpisode: jest.fn(),
  };
  const mailchimpClient = {
    createCampaign: jest.fn().mockResolvedValue({ id: 'cmp1' }),
    setContent: jest.fn().mockResolvedValue({}),
    scheduleCampaign: jest.fn().mockResolvedValue({}),
    sendCampaign: jest.fn().mockResolvedValue({}),
    getCampaign: jest.fn().mockResolvedValue({ status: 'schedule', recipients: { recipient_count: 42 } }),
  };
  const sendLog = {
    claim: jest.fn().mockResolvedValue(claim),
    reclaimFailed: jest.fn().mockResolvedValue(reclaim),
    finish: jest.fn().mockResolvedValue(true),
    select: jest.fn().mockResolvedValue(row ? [row] : []),
  };
  return {
    lines,
    deps: {
      now: () => now,
      logger: { log: (line) => lines.push(line) },
      convertToMp3: jest.fn().mockResolvedValue({ buffer: mp3(), inputFormat: 'ogg' }),
      castosClient,
      mailchimpClient,
      sendLog,
      verifyAudioUrl: jest.fn().mockResolvedValue({ url: AUDIO_URL, checks: 1 }),
      writeFile: jest.fn().mockResolvedValue(),
      mkdir: jest.fn().mockResolvedValue(),
      pollOptions: { sleep: jest.fn().mockResolvedValue(), attempts: 3, intervalMs: 1 },
    },
  };
};

const run = (mode, deps, overrides = {}) =>
  runTefillaPipeline({ audio: voiceNote(), title: TITLE, config: config(mode), deps, ...overrides });

describe('dry run', () => {
  test('converts and renders, writes the preview, and creates nothing', async () => {
    const { deps, lines } = makeDeps();
    const result = await run('dry-run', deps);

    expect(result).toMatchObject({
      status: 'dry-run',
      mode: 'dry-run',
      title: CLEAN_TITLE,
      shiurKey: '877',
      date: '2026-11-17',
      subject: CLEAN_TITLE,
      audio: { inputFormat: 'ogg', filename: '877-which-good-years-do-we-refer-to.mp3' },
      plan: { castos: { mode: 'schedule', post_date: '2026-11-17 05:15:00' }, email: { action: 'schedule' } },
    });
    expect(deps.convertToMp3).toHaveBeenCalledWith(expect.any(Buffer));
    expect(deps.castosClient.listEpisodes).not.toHaveBeenCalled();
    expect(deps.castosClient.createEpisode).not.toHaveBeenCalled();
    expect(deps.mailchimpClient.createCampaign).not.toHaveBeenCalled();
    expect(deps.sendLog.claim).not.toHaveBeenCalled();

    const written = Object.fromEntries(deps.writeFile.mock.calls.map(([file, body]) => [file.split('.').pop(), body]));
    expect(Object.keys(written).sort()).toEqual(['html', 'json', 'mp3']);
    expect(NodeID3.read(written.mp3)).toMatchObject({ title: CLEAN_TITLE, artist: 'Time4Tefilla', album: 'Time4Tefilla' });
    expect(written.html).toContain('*|UNSUB|*');
    expect(written.html).toContain('*|UPDATE_PROFILE|*');
    const preview = JSON.parse(written.json);
    expect(preview.castos.request.fields).toMatchObject({ post_title: CLEAN_TITLE, post_date: '2026-11-17 05:15:00' });
    expect(lines.join('\n')).toMatch(/nothing created in Castos or Mailchimp/);
  });
});

describe('live send', () => {
  test('before 05:15: schedules the episode and the campaign for 05:15 and records sent', async () => {
    const { deps } = makeDeps();
    const result = await run('live', deps);

    expect(deps.sendLog.claim).toHaveBeenCalledWith({
      date: '2026-11-17',
      program: 'time4tefilla',
      channel: 'email',
      mode: 'live',
      audience: 'tefilla-list',
      shiurKey: '877',
    });
    const [podcastId, fields, file] = deps.castosClient.createEpisode.mock.calls[0];
    expect(podcastId).toBe('300');
    expect(fields).toMatchObject({ post_title: CLEAN_TITLE, post_date: '2026-11-17 05:15:00' });
    expect(fields.post_content).toContain('Support Time4Tefilla');
    expect(file).toMatchObject({ filename: '877-which-good-years-do-we-refer-to.mp3', contentType: 'audio/mpeg' });
    expect(deps.verifyAudioUrl).toHaveBeenCalledWith(AUDIO_URL, deps.pollOptions);

    const campaign = deps.mailchimpClient.createCampaign.mock.calls[0][0];
    expect(campaign.recipients).toEqual({ list_id: 'tefilla-list' });
    expect(campaign.settings).toMatchObject({
      subject_line: CLEAN_TITLE,
      preview_text: CLEAN_TITLE,
      from_name: 'Time4Tefilla',
      reply_to: 'tefilla@time4torah.org',
      title: 'time4tefilla 2026-11-17 #877',
    });
    const content = deps.mailchimpClient.setContent.mock.calls[0][1];
    expect(content.html).toContain(`<a href="${AUDIO_URL}"`);
    expect(content.html).toContain('*|UNSUB|*');
    expect(content.html).toContain('*|UPDATE_PROFILE|*');
    expect(deps.mailchimpClient.scheduleCampaign).toHaveBeenCalledWith('cmp1', new Date('2026-11-17T05:15:00Z'));
    expect(deps.mailchimpClient.sendCampaign).not.toHaveBeenCalled();

    expect(deps.sendLog.finish).toHaveBeenCalledWith(expect.objectContaining({ shiurKey: '877' }), {
      status: 'sent',
      providerMessageId: 'mailchimp:cmp1; castos:555',
    });
    expect(result).toMatchObject({
      status: 'scheduled',
      campaignId: 'cmp1',
      audience: 'tefilla-list',
      castos: { podcastId: '300', episodeId: 555, reused: false, audioUrl: AUDIO_URL },
    });
    expect(result.logError).toBeUndefined();
  });

  test('after 05:15: publishes the episode and sends the campaign now', async () => {
    const { deps } = makeDeps({ now: AFTER });
    const result = await run('live', deps);

    expect(deps.castosClient.createEpisode.mock.calls[0][1]).not.toHaveProperty('post_date');
    expect(deps.mailchimpClient.sendCampaign).toHaveBeenCalledWith('cmp1');
    expect(deps.mailchimpClient.scheduleCampaign).not.toHaveBeenCalled();
    expect(result.status).toBe('sent');
  });

  test('from 16:00: both are scheduled for 05:15 the next morning', async () => {
    const { deps } = makeDeps({ now: EVENING });
    const result = await run('live', deps);

    expect(deps.sendLog.claim.mock.calls[0][0]).toMatchObject({ date: '2026-11-18', shiurKey: '877' });
    expect(deps.castosClient.createEpisode.mock.calls[0][1].post_date).toBe('2026-11-18 05:15:00');
    expect(deps.mailchimpClient.scheduleCampaign).toHaveBeenCalledWith('cmp1', new Date('2026-11-18T05:15:00Z'));
    expect(deps.mailchimpClient.sendCampaign).not.toHaveBeenCalled();
    expect(deps.mailchimpClient.createCampaign.mock.calls[0][0].settings.title).toBe('time4tefilla 2026-11-18 #877');
    expect(result.status).toBe('scheduled');
  });

  test('too close to 05:15 for Mailchimp to schedule: both go out now', async () => {
    const { deps } = makeDeps({ now: JUST_BEFORE });
    await run('live', deps);

    expect(deps.castosClient.createEpisode.mock.calls[0][1]).not.toHaveProperty('post_date');
    expect(deps.mailchimpClient.sendCampaign).toHaveBeenCalled();
  });

  test('re-plans the email after publishing: a 05:15 slot that came too close is sent now', async () => {
    const { deps, lines } = makeDeps();
    const times = [new Date('2026-11-17T05:08:00Z'), new Date('2026-11-17T05:11:30Z')];
    deps.now = () => times.shift();

    const result = await run('live', deps);

    expect(deps.castosClient.createEpisode.mock.calls[0][1].post_date).toBe('2026-11-17 05:15:00');
    expect(deps.mailchimpClient.scheduleCampaign).not.toHaveBeenCalled();
    expect(deps.mailchimpClient.sendCampaign).toHaveBeenCalledWith('cmp1');
    expect(result).toMatchObject({ status: 'sent', plan: { email: { action: 'send' } } });
    expect(lines.join('\n')).toContain('email plan changed while publishing: send now');
  });

  test('logs the episode and file from the create response, not the show settings', async () => {
    const { deps, lines } = makeDeps({
      createResponse: {
        success: true,
        message: 'Episode created!',
        episode: {
          id: 555,
          post_title: CLEAN_TITLE,
          post_content: '<p>show notes</p>',
          podcast_id: '300',
          episode_status_id: 7,
          podcast: { apple_claim_token: 'secret-claim-token' },
        },
        file: { id: 9, file_name: 'x.mp3', file_size: 1923449, file_duration: '00:04:01', file_path: AUDIO_URL },
      },
    });
    await run('live', deps);
    const log = lines.join('\n');
    expect(log).toContain(
      `castos: created {"success":true,"message":"Episode created!","episode":{"id":555,"title":"${CLEAN_TITLE}","podcast_id":"300","status_id":7},` +
        `"file":{"id":9,"name":"x.mp3","size":1923449,"duration":"00:04:01","url":"${AUDIO_URL}"}}`
    );
    expect(log).not.toContain('secret-claim-token');
    expect(log).not.toContain('show notes');
  });

  test('falls back to GET /episodes/{id} when the create response has no audio URL', async () => {
    const { deps } = makeDeps({ createResponse: { success: true, episode: { id: 555 } } });
    deps.waitForEpisodeAudioUrl = undefined;
    deps.castosClient.getEpisode
      .mockResolvedValueOnce({ id: 555, file: { import_status: 'processing' } })
      .mockResolvedValueOnce({ id: 555, file: { file_name: 'x.mp3', file_path: AUDIO_URL } });

    const result = await run('live', deps);

    expect(deps.castosClient.getEpisode).toHaveBeenCalledWith('300', 555);
    expect(deps.castosClient.getEpisode).toHaveBeenCalledTimes(2);
    expect(result.castos.audioUrl).toBe(AUDIO_URL);
  });

  test('fails clearly when the create response has neither an id nor an audio URL', async () => {
    const { deps } = makeDeps({ createResponse: { success: true } });
    await expect(run('live', deps)).rejects.toMatchObject({ status: 502, stage: 'castos' });
    expect(deps.mailchimpClient.createCampaign).not.toHaveBeenCalled();
    expect(deps.sendLog.finish).toHaveBeenCalledWith(expect.anything(), { status: 'failed' });
  });

  test('reuses an episode already on the show with the same title', async () => {
    const { deps, lines } = makeDeps({
      episodes: [{ id: 444, post_title: CLEAN_TITLE, file: { url: AUDIO_URL } }],
    });
    const result = await run('live', deps);

    expect(deps.castosClient.createEpisode).not.toHaveBeenCalled();
    expect(result.castos).toMatchObject({ episodeId: 444, reused: true, audioUrl: AUDIO_URL });
    expect(lines.join('\n')).toMatch(/already has episode 444/);
  });

  test('sends nothing when the audio URL never returns 200, and records failed', async () => {
    const { deps } = makeDeps();
    deps.verifyAudioUrl.mockRejectedValue(new Error(`The episode audio ${AUDIO_URL} did not return 200 after 12 check(s)`));

    await expect(run('live', deps)).rejects.toMatchObject({
      status: 502,
      stage: 'verify-audio',
      message: expect.stringContaining('Castos episode 555 exists'),
    });
    expect(deps.mailchimpClient.createCampaign).not.toHaveBeenCalled();
    expect(deps.sendLog.finish).toHaveBeenCalledWith(expect.anything(), { status: 'failed' });
  });

  test('a Castos API error becomes a 502 at the castos stage, not its own status', async () => {
    const { deps } = makeDeps();
    deps.castosClient.createEpisode.mockRejectedValue(
      new CastosError('Castos POST /podcasts/300/episodes returned 422: bad', { status: 422 })
    );
    await expect(run('live', deps)).rejects.toMatchObject({ status: 502, stage: 'castos' });
    expect(deps.sendLog.finish).toHaveBeenCalledWith(expect.anything(), { status: 'failed' });
  });

  test('a Mailchimp failure records failed', async () => {
    const { deps } = makeDeps();
    deps.mailchimpClient.setContent.mockRejectedValue(new Error('Mailchimp PUT returned 400: bad html'));
    await expect(run('live', deps)).rejects.toMatchObject({ status: 502, stage: 'mailchimp', episodeId: 555 });
    expect(deps.sendLog.finish).toHaveBeenCalledWith(expect.anything(), { status: 'failed' });
  });

  test('an uncertain Mailchimp outcome leaves send_log claimed', async () => {
    const { deps } = makeDeps();
    deps.mailchimpClient.scheduleCampaign.mockRejectedValue(new Error('socket hang up'));
    deps.mailchimpClient.getCampaign.mockRejectedValue(new Error('timeout'));

    await expect(run('live', deps)).rejects.toMatchObject({
      status: 502,
      stage: 'mailchimp',
      message: expect.stringContaining('send_log left claimed'),
    });
    expect(deps.sendLog.finish).not.toHaveBeenCalled();
  });

  test('reports, but does not fail on, a send_log write error after sending', async () => {
    const { deps } = makeDeps();
    deps.sendLog.finish.mockRejectedValue(new Error('db down'));
    const result = await run('live', deps);
    expect(result.status).toBe('scheduled');
    expect(result.logError).toMatch(/db down/);
  });
});

describe('send_log: the same shiur never goes out twice', () => {
  test('already sent: 409, and nothing is created', async () => {
    const { deps } = makeDeps({
      claim: false,
      row: { status: 'sent', send_date: '2026-11-10', provider_message_id: 'mailchimp:old; castos:1' },
    });
    await expect(run('live', deps)).rejects.toMatchObject({
      status: 409,
      stage: 'send_log',
      message: expect.stringContaining('already went out on 2026-11-10'),
    });
    expect(deps.castosClient.createEpisode).not.toHaveBeenCalled();
    expect(deps.mailchimpClient.createCampaign).not.toHaveBeenCalled();
  });

  test('still claimed (in progress or interrupted): 409', async () => {
    const { deps } = makeDeps({ claim: false, row: { status: 'claimed', send_date: '2026-11-17' } });
    await expect(run('live', deps)).rejects.toMatchObject({ status: 409, message: expect.stringContaining('stopped part-way') });
    expect(deps.castosClient.createEpisode).not.toHaveBeenCalled();
  });

  test('an earlier failed attempt is reclaimed and retried', async () => {
    const { deps } = makeDeps({ claim: false, reclaim: true });
    const result = await run('live', deps);
    expect(deps.sendLog.reclaimFailed).toHaveBeenCalled();
    expect(result.status).toBe('scheduled');
  });

  test('the shiur number is the key, so a retyped title is still the same shiur', async () => {
    const { deps } = makeDeps();
    await run('live', deps, { title: '877 - Which Good Years?' });
    expect(deps.sendLog.claim.mock.calls[0][0].shiurKey).toBe('877');
  });
});

describe('test mode', () => {
  test('uses the test show and audience and marks the campaign TEST', async () => {
    const { deps, lines } = makeDeps();
    const result = await run('test', deps);

    expect(deps.castosClient.createEpisode.mock.calls[0][0]).toBe('100');
    const campaign = deps.mailchimpClient.createCampaign.mock.calls[0][0];
    expect(campaign.recipients).toEqual({ list_id: 'test-list' });
    expect(campaign.settings.title).toBe('TEST time4tefilla 2026-11-17 #877');
    expect(deps.sendLog.claim.mock.calls[0][0]).toMatchObject({ mode: 'live', audience: 'test-list' });
    expect(lines.join('\n')).toContain('castos: created {"success":true,"episode":{"id":555},"file":{"name":"x.mp3"}}');
    expect(result.audience).toBe('test-list');
  });
});

describe('input checks', () => {
  test.each([
    ['no title', { title: '   ' }, 'A shiur title is required'],
    ['no audio', { audio: Buffer.alloc(0) }, 'An audio file is required'],
  ])('%s: 400 before anything runs', async (_name, overrides, message) => {
    const { deps } = makeDeps();
    await expect(run('live', deps, overrides)).rejects.toMatchObject({ status: 400, message });
    expect(deps.convertToMp3).not.toHaveBeenCalled();
    expect(deps.sendLog.claim).not.toHaveBeenCalled();
  });

  test('a conversion error stops the run before send_log or Castos', async () => {
    const { deps } = makeDeps();
    deps.convertToMp3.mockRejectedValue(Object.assign(new Error('not audio'), { status: 400 }));
    await expect(run('live', deps)).rejects.toMatchObject({ status: 400 });
    expect(deps.sendLog.claim).not.toHaveBeenCalled();
    expect(deps.castosClient.listEpisodes).not.toHaveBeenCalled();
  });
});
