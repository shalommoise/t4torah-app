const axios = require('axios');
const NodeID3 = require('node-id3');

// Fetching the shiur audio from the bucket, checking it's a format Castos
// accepts (MP3 or M4A), and setting MP3 ID3 tags. There is no conversion:
// anything else is refused with a message saying to convert it first.

const FETCH_TIMEOUT_MS = 2 * 60 * 1000;
const MAX_AUDIO_BYTES = 300 * 1024 * 1024;

const FORMATS = {
  mp3: { extension: 'mp3', contentType: 'audio/mpeg' },
  m4a: { extension: 'm4a', contentType: 'audio/mp4' },
};

/**
 * The audio format from the file's first bytes, ignoring its name:
 * - `mp3`: an ID3v2 header, or an MPEG audio frame sync with layer I–III
 *   (AAC ADTS has the same sync but layer bits 00, so it is not MP3);
 * - `m4a`: an ISO media file (`ftyp` box at byte 4);
 * - `null`: anything else.
 *
 * @param {Buffer} buffer
 * @returns {'mp3'|'m4a'|null}
 */
const detectAudioFormat = (buffer) => {
  if (!Buffer.isBuffer(buffer) || buffer.length < 12) {
    return null;
  }
  if (buffer.toString('latin1', 0, 3) === 'ID3') {
    return 'mp3';
  }
  const layerBits = (buffer[1] >> 1) & 0b11;
  if (buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0 && layerBits !== 0) {
    return 'mp3';
  }
  if (buffer.toString('latin1', 4, 8) === 'ftyp') {
    return 'm4a';
  }
  return null;
};

/**
 * Downloads a file from the bucket as a Buffer.
 *
 * @param {string} url
 * @param {(config: object) => Promise<{ data: ArrayBuffer|Buffer }>} [request] Defaults to axios.request.
 * @returns {Promise<Buffer>}
 */
const fetchAudio = async (url, request = axios.request) => {
  const response = await request({
    method: 'GET',
    url,
    responseType: 'arraybuffer',
    timeout: FETCH_TIMEOUT_MS,
    maxContentLength: MAX_AUDIO_BYTES,
  });
  return Buffer.from(response.data);
};

/**
 * Sets ID3 tags on an MP3, keeping any tags it already has (e.g. cover art).
 *
 * @param {Buffer} buffer
 * @param {{ title: string, artist: string, album: string, year: string }} tags
 * @returns {Buffer}
 */
const tagMp3 = (buffer, { title, artist, album, year }) => {
  const tagged = NodeID3.update({ title, artist, album, year }, buffer);
  if (!Buffer.isBuffer(tagged)) {
    throw new Error(`Setting ID3 tags failed: ${(tagged && tagged.message) || 'unknown error'}`);
  }
  return tagged;
};

/**
 * Checks the audio and prepares it for upload: MP3 gets ID3 tags, M4A is sent
 * as is (ID3 doesn't apply to it), anything else is refused.
 *
 * @param {Buffer} buffer
 * @param {{ baseName: string, tags: { title: string, artist: string, album: string, year: string } }} options
 *   `baseName` is the upload's file name without extension.
 * @returns {{ buffer: Buffer, filename: string, contentType: string, format: 'mp3'|'m4a', tagged: boolean }}
 * @throws when the format isn't MP3 or M4A.
 */
const prepareAudio = (buffer, { baseName, tags }) => {
  const format = detectAudioFormat(buffer);
  if (!format) {
    throw new Error(`${baseName}: not MP3 or M4A; convert it (e.g. with ffmpeg) before publishing`);
  }
  const { extension, contentType } = FORMATS[format];
  return {
    buffer: format === 'mp3' ? tagMp3(buffer, tags) : buffer,
    filename: `${baseName}.${extension}`,
    contentType,
    format,
    tagged: format === 'mp3',
  };
};

module.exports = { FORMATS, detectAudioFormat, fetchAudio, tagMp3, prepareAudio };
