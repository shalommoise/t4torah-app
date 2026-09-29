/**
 * @typedef {'email'|'whatsapp'} Channel
 */

/**
 * @typedef {object} SendResult
 * @property {boolean} ok
 * @property {string} [id] Provider or outbox id of the sent message.
 * @property {string} [error] Why the send failed, when `ok` is false.
 */

/**
 * A sender delivers a DailyMessage (see render/dailyMessage.js) over one channel.
 *
 * @typedef {object} Sender
 * @property {string} name
 * @property {Channel} channel
 * @property {(message: import('../render/dailyMessage').DailyMessage) => Promise<SendResult>} send
 */

/**
 * @typedef {(config: object) => Sender} SenderFactory
 */

const CHANNELS = ['email', 'whatsapp'];
const MODES = ['dry-run', 'live'];
const DEFAULT_MODE = 'dry-run';

/**
 * Sender factories by mode and channel. Dry-run senders (backlog C2) and
 * live-mode stubs (C3) are registered here; live mode is only used when
 * `config.mode === 'live'`.
 *
 * @type {Record<string, Record<Channel, SenderFactory[]>>}
 */
const SENDER_REGISTRY = {
  'dry-run': { email: [], whatsapp: [] },
  live: { email: [], whatsapp: [] },
};

/**
 * Throws unless `sender` implements the Sender interface.
 *
 * @param {unknown} sender
 * @returns {Sender}
 */
const assertSender = (sender) => {
  if (!sender || typeof sender.name !== 'string' || !sender.name) {
    throw new TypeError('Sender must have a non-empty string name');
  }
  if (!CHANNELS.includes(sender.channel)) {
    throw new TypeError(`Sender ${sender.name} has unknown channel: ${sender.channel}`);
  }
  if (typeof sender.send !== 'function') {
    throw new TypeError(`Sender ${sender.name} must have a send(message) function`);
  }
  return sender;
};

/**
 * Builds the senders for a send run.
 *
 * @param {{ mode?: 'dry-run'|'live', channels?: Channel[] }} [config]
 *   `mode` defaults to dry-run; `channels` defaults to all channels.
 * @param {typeof SENDER_REGISTRY} [registry]
 * @returns {Sender[]}
 */
const getSenders = (config = {}, registry = SENDER_REGISTRY) => {
  const mode = config.mode === undefined ? DEFAULT_MODE : config.mode;
  if (!MODES.includes(mode)) {
    throw new Error(`Unknown send mode: ${mode}`);
  }

  const channels = config.channels === undefined ? CHANNELS : config.channels;
  const unknownChannel = channels.find((channel) => !CHANNELS.includes(channel));
  if (unknownChannel !== undefined) {
    throw new Error(`Unknown channel: ${unknownChannel}`);
  }

  return channels.flatMap((channel) =>
    ((registry[mode] || {})[channel] || []).map((createSender) => {
      const sender = assertSender(createSender(config));
      if (sender.channel !== channel) {
        throw new Error(`Sender ${sender.name} registered for ${channel} but has channel ${sender.channel}`);
      }
      return sender;
    })
  );
};

module.exports = { CHANNELS, MODES, DEFAULT_MODE, SENDER_REGISTRY, assertSender, getSenders };
