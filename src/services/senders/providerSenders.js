// Live-mode WhatsApp placeholder. No WhatsApp BSP (Wati / AiSensy) has been
// chosen, so this sender must not contact anything: send() always rejects.
// Live email goes through ./mailchimpSender.js. See docs/SENDING.md.

const NOT_IMPLEMENTED = 'Not implemented: provider not chosen';

const createStubSender = (name, channel) => ({
  name,
  channel,
  send: async () => {
    throw new Error(NOT_IMPLEMENTED);
  },
});

/**
 * TODO(provider): pass a provider idempotency key (e.g. `${date}:${program}:whatsapp`)
 * if the BSP supports one, so a resend after an interrupted run can't duplicate.
 *
 * @returns {import('./index').Sender}
 */
const createWhatsappProviderSender = () => createStubSender('whatsappProviderSender', 'whatsapp');

module.exports = { NOT_IMPLEMENTED, createWhatsappProviderSender };
