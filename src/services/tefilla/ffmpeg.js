const childProcess = require('child_process');
const fs = require('fs/promises');
const os = require('os');
const path = require('path');
const { detectAudioFormat } = require('../castos/audio');

// Converting an uploaded shiur to a mono 64 kbps MP3 (fine for speech) with
// ffmpeg. Every input is re-encoded, whatever its format, so Castos always
// gets the same kind of file. ffmpeg runs without a shell, on a temp copy in
// its own directory, which is always deleted afterwards.

const FFMPEG = 'ffmpeg';
const CONVERT_TIMEOUT_MS = 2 * 60 * 1000;
const CHECK_TIMEOUT_MS = 10 * 1000;
const MAX_STDERR_LENGTH = 500;

const NOT_INSTALLED = 'ffmpeg is not installed or not on PATH (on Debian/Ubuntu: sudo apt install ffmpeg)';

const fail = (message, status) => Object.assign(new Error(message), { status });

/**
 * The upload's format from its first bytes: `ogg` (WhatsApp voice notes are
 * Opus in an Ogg container), `m4a` or `mp3`; `null` for anything else.
 *
 * @param {Buffer} buffer
 * @returns {'ogg'|'m4a'|'mp3'|null}
 */
const detectUploadFormat = (buffer) => {
  if (Buffer.isBuffer(buffer) && buffer.length >= 4 && buffer.toString('latin1', 0, 4) === 'OggS') {
    return 'ogg';
  }
  return detectAudioFormat(buffer);
};

/**
 * Runs ffmpeg with `args`. Resolves with stdout; rejects with a clear message
 * when ffmpeg is missing (status 503), times out, or exits non-zero.
 */
const runFfmpeg = (args, { spawn, timeoutMs }) =>
  new Promise((resolve, reject) => {
    let child;
    try {
      child = spawn(FFMPEG, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (error) {
      reject(error && error.code === 'ENOENT' ? fail(NOT_INSTALLED, 503) : error);
      return;
    }
    let stdout = '';
    let stderr = '';
    let settled = false;
    const settle = (fn, value) => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        fn(value);
      }
    };
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      settle(reject, fail(`ffmpeg took longer than ${Math.round(timeoutMs / 1000)}s and was stopped`, 500));
    }, timeoutMs);

    child.stdout.on('data', (chunk) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk) => {
      stderr = `${stderr}${chunk}`.slice(-MAX_STDERR_LENGTH);
    });
    child.on('error', (error) => {
      settle(reject, error && error.code === 'ENOENT' ? fail(NOT_INSTALLED, 503) : error);
    });
    child.on('close', (code) => {
      if (code === 0) {
        settle(resolve, stdout);
      } else {
        settle(reject, fail(`ffmpeg could not convert the audio (exit ${code}): ${stderr.trim() || 'no output'}`, 400));
      }
    });
  });

/**
 * Converts an uploaded OGG/Opus, M4A or MP3 to a mono 64 kbps MP3. Anything
 * else is refused (status 400) before ffmpeg runs.
 *
 * @param {Buffer} input
 * @param {object} [options]
 * @param {typeof childProcess.spawn} [options.spawn] For tests.
 * @param {string} [options.tmpDir] Defaults to the OS temp directory.
 * @param {number} [options.timeoutMs]
 * @returns {Promise<{ buffer: Buffer, inputFormat: 'ogg'|'m4a'|'mp3' }>}
 */
const convertToMp3 = async (input, { spawn = childProcess.spawn, tmpDir = os.tmpdir(), timeoutMs = CONVERT_TIMEOUT_MS } = {}) => {
  const inputFormat = detectUploadFormat(input);
  if (!inputFormat) {
    throw fail('The upload is not an OGG/Opus voice note, M4A or MP3 file', 400);
  }

  const dir = await fs.mkdtemp(path.join(tmpDir, 't4t-tefilla-'));
  try {
    const inputPath = path.join(dir, `input.${inputFormat}`);
    const outputPath = path.join(dir, 'output.mp3');
    await fs.writeFile(inputPath, input);
    await runFfmpeg(
      ['-hide_banner', '-loglevel', 'error', '-nostdin', '-y', '-i', inputPath, '-vn', '-ac', '1', '-b:a', '64k', '-f', 'mp3', outputPath],
      { spawn, timeoutMs }
    );
    const buffer = await fs.readFile(outputPath);
    if (detectAudioFormat(buffer) !== 'mp3') {
      throw fail('ffmpeg finished but did not produce an MP3', 500);
    }
    return { buffer, inputFormat };
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
};

/**
 * Whether ffmpeg can be run, and its version line.
 *
 * @param {{ spawn?: typeof childProcess.spawn, timeoutMs?: number }} [options]
 * @returns {Promise<{ ok: true, version: string } | { ok: false, error: string }>}
 */
const checkFfmpeg = async ({ spawn = childProcess.spawn, timeoutMs = CHECK_TIMEOUT_MS } = {}) => {
  try {
    const stdout = await runFfmpeg(['-hide_banner', '-version'], { spawn, timeoutMs });
    return { ok: true, version: String(stdout).split('\n')[0].trim() };
  } catch (error) {
    return { ok: false, error: (error && error.message) || String(error) };
  }
};

module.exports = { NOT_INSTALLED, detectUploadFormat, convertToMp3, checkFfmpeg };
