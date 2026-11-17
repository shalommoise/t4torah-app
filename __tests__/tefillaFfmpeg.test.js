const { EventEmitter } = require('events');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { NOT_INSTALLED, detectUploadFormat, convertToMp3, checkFfmpeg } = require('../src/services/tefilla/ffmpeg');

const mp3 = () => Buffer.concat([Buffer.from([0xff, 0xfb, 0x90, 0x64]), Buffer.alloc(400)]);
const ogg = () => Buffer.concat([Buffer.from('OggS'), Buffer.alloc(100)]);
const m4a = () => Buffer.concat([Buffer.from([0, 0, 0, 0x20]), Buffer.from('ftypM4A '), Buffer.alloc(40)]);

/**
 * A fake child_process.spawn. `behaviour(args, child)` decides what the
 * "ffmpeg" does; by default it writes an MP3 to the output path and exits 0.
 */
const fakeSpawn = (behaviour) =>
  jest.fn((command, args) => {
    const child = new EventEmitter();
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    child.kill = jest.fn();
    setImmediate(() => behaviour(args, child));
    return child;
  });

const writesMp3 = (args, child) => {
  fs.writeFileSync(args[args.length - 1], mp3());
  child.emit('close', 0);
};

let tmpDir;
beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tefilla-ffmpeg-test-'));
});
afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

const leftovers = () => fs.readdirSync(tmpDir);

describe('detectUploadFormat', () => {
  test.each([
    ['WhatsApp voice note (Ogg/Opus)', ogg(), 'ogg'],
    ['m4a', m4a(), 'm4a'],
    ['mp3', mp3(), 'mp3'],
    ['wav', Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WAVE'), Buffer.alloc(20)]), null],
    ['empty', Buffer.alloc(0), null],
  ])('%s', (_name, buffer, expected) => {
    expect(detectUploadFormat(buffer)).toBe(expected);
  });
});

describe('convertToMp3', () => {
  test.each([
    ['ogg', ogg()],
    ['m4a', m4a()],
    ['mp3', mp3()],
  ])('re-encodes %s to mono 64k MP3 with ffmpeg, then deletes the temp files', async (format, input) => {
    const spawn = fakeSpawn((args, child) => {
      expect(fs.readFileSync(args[args.indexOf('-i') + 1])).toEqual(input);
      writesMp3(args, child);
    });

    const result = await convertToMp3(input, { spawn, tmpDir });

    expect(result.inputFormat).toBe(format);
    expect(result.buffer).toEqual(mp3());
    const [command, args, options] = spawn.mock.calls[0];
    expect(command).toBe('ffmpeg');
    expect(args).toEqual(expect.arrayContaining(['-ac', '1', '-b:a', '64k', '-f', 'mp3', '-nostdin', '-y']));
    expect(args.join(' ')).toMatch(/-ac 1 -b:a 64k/);
    expect(options).not.toHaveProperty('shell');
    expect(leftovers()).toEqual([]);
  });

  test('refuses a format other than OGG, M4A or MP3 without running ffmpeg', async () => {
    const spawn = fakeSpawn(writesMp3);
    await expect(convertToMp3(Buffer.from('not audio at all'), { spawn, tmpDir })).rejects.toMatchObject({
      status: 400,
      message: 'The upload is not an OGG/Opus voice note, M4A or MP3 file',
    });
    expect(spawn).not.toHaveBeenCalled();
  });

  test('ffmpeg missing: a clear 503, and the temp files are deleted', async () => {
    const spawn = fakeSpawn((args, child) => child.emit('error', Object.assign(new Error('spawn ffmpeg ENOENT'), { code: 'ENOENT' })));
    await expect(convertToMp3(ogg(), { spawn, tmpDir })).rejects.toMatchObject({ status: 503, message: NOT_INSTALLED });
    expect(leftovers()).toEqual([]);
  });

  test('ffmpeg fails: 400 with its error output, and the temp files are deleted', async () => {
    const spawn = fakeSpawn((args, child) => {
      child.stderr.emit('data', 'Invalid data found when processing input\n');
      child.emit('close', 1);
    });
    await expect(convertToMp3(ogg(), { spawn, tmpDir })).rejects.toMatchObject({
      status: 400,
      message: expect.stringContaining('Invalid data found when processing input'),
    });
    expect(leftovers()).toEqual([]);
  });

  test('output that is not an MP3 is refused', async () => {
    const spawn = fakeSpawn((args, child) => {
      fs.writeFileSync(args[args.length - 1], Buffer.from('garbage-garbage'));
      child.emit('close', 0);
    });
    await expect(convertToMp3(ogg(), { spawn, tmpDir })).rejects.toMatchObject({ message: 'ffmpeg finished but did not produce an MP3' });
    expect(leftovers()).toEqual([]);
  });

  test('a hung ffmpeg is killed after the timeout', async () => {
    const spawn = fakeSpawn(() => {});
    await expect(convertToMp3(ogg(), { spawn, tmpDir, timeoutMs: 20 })).rejects.toThrow(/took longer than/);
    expect(spawn.mock.results[0].value.kill).toHaveBeenCalledWith('SIGKILL');
    expect(leftovers()).toEqual([]);
  });
});

describe('checkFfmpeg', () => {
  test('ok with the version line', async () => {
    const spawn = fakeSpawn((args, child) => {
      child.stdout.emit('data', 'ffmpeg version 6.1.1 Copyright\nbuilt with gcc\n');
      child.emit('close', 0);
    });
    await expect(checkFfmpeg({ spawn })).resolves.toEqual({ ok: true, version: 'ffmpeg version 6.1.1 Copyright' });
    expect(spawn.mock.calls[0][1]).toContain('-version');
  });

  test('not installed', async () => {
    const spawn = jest.fn(() => {
      throw Object.assign(new Error('spawn ffmpeg ENOENT'), { code: 'ENOENT' });
    });
    await expect(checkFfmpeg({ spawn })).resolves.toEqual({ ok: false, error: NOT_INSTALLED });
  });
});
