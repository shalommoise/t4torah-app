const NodeID3 = require('node-id3');
const { detectAudioFormat, fetchAudio, tagMp3, prepareAudio } = require('../src/services/castos/audio');

// A minimal MPEG-1 Layer III frame header (0xFFFB) followed by padding.
const rawMp3 = () => Buffer.concat([Buffer.from([0xff, 0xfb, 0x90, 0x64]), Buffer.alloc(400)]);
const id3Mp3 = () => NodeID3.update({ title: 'old', comment: { language: 'eng', text: 'keep me' } }, rawMp3());
const m4a = () => Buffer.concat([Buffer.from([0, 0, 0, 0x20]), Buffer.from('ftypM4A '), Buffer.alloc(40)]);
const tags = { title: 'Shabbos 20.2-20.5', artist: 'Time4Mishna', album: 'Time4Mishna', year: '2026' };

describe('detectAudioFormat', () => {
  test.each([
    ['ID3-tagged mp3', id3Mp3(), 'mp3'],
    ['untagged mp3 frame', rawMp3(), 'mp3'],
    ['m4a', m4a(), 'm4a'],
    ['AAC ADTS (same sync, layer 00)', Buffer.concat([Buffer.from([0xff, 0xf1, 0x50, 0x80]), Buffer.alloc(20)]), null],
    ['WAV', Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WAVE'), Buffer.alloc(20)]), null],
    ['too short', Buffer.from('ID3'), null],
    ['not a buffer', 'ID3xxxxxxxxxxx', null],
  ])('%s', (_name, buffer, expected) => {
    expect(detectAudioFormat(buffer)).toBe(expected);
  });
});

describe('tagMp3', () => {
  test('sets title, artist, album and year, keeping other tags', () => {
    const tagged = tagMp3(id3Mp3(), tags);
    const read = NodeID3.read(tagged);
    expect(read).toMatchObject(tags);
    expect(read.comment.text).toBe('keep me');
    expect(detectAudioFormat(tagged)).toBe('mp3');
  });

  test('tags an mp3 with no ID3 header', () => {
    expect(NodeID3.read(tagMp3(rawMp3(), tags)).title).toBe('Shabbos 20.2-20.5');
  });
});

describe('prepareAudio', () => {
  test('mp3: tagged, .mp3, audio/mpeg', () => {
    const audio = prepareAudio(rawMp3(), { baseName: 'shabbos_20.2-20.5', tags });
    expect(audio).toMatchObject({
      filename: 'shabbos_20.2-20.5.mp3',
      contentType: 'audio/mpeg',
      format: 'mp3',
      tagged: true,
    });
    expect(NodeID3.read(audio.buffer).album).toBe('Time4Mishna');
  });

  test('m4a: sent as is with .m4a', () => {
    const source = m4a();
    const audio = prepareAudio(source, { baseName: 'x', tags });
    expect(audio).toMatchObject({ filename: 'x.m4a', contentType: 'audio/mp4', format: 'm4a', tagged: false });
    expect(audio.buffer).toBe(source);
  });

  test('anything else is refused with a hint to convert', () => {
    expect(() => prepareAudio(Buffer.alloc(50), { baseName: 'x', tags })).toThrow(/not MP3 or M4A; convert it/);
  });
});

describe('fetchAudio', () => {
  test('downloads as an array buffer and returns a Buffer', async () => {
    const request = jest.fn().mockResolvedValue({ data: new Uint8Array([1, 2, 3]).buffer });
    const buffer = await fetchAudio('https://bucket/a.mp3', request);
    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect([...buffer]).toEqual([1, 2, 3]);
    expect(request.mock.calls[0][0]).toMatchObject({ method: 'GET', url: 'https://bucket/a.mp3', responseType: 'arraybuffer' });
  });
});
