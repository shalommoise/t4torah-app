// Live-mode placeholders. The email provider (MailerLite / Brevo) and the
// WhatsApp BSP (Wati / AiSensy) haven't been chosen, so these senders must
// not contact anything: send() always rejects. Replace them with real
// implementations once a provider is chosen (see the checklist in docs/SENDING.md).

const NOT_IMPLEMENTED = 'Not implemented: provider not chosen';

const createStubSender = (name, channel) => ({
  name,
  channel,
  send: async () => {
    throw new Error(NOT_IMPLEMENTED);
  },
});

/**
 * TODO(provider): pass a provider idempotency key (e.g. `${date}:${program}:email`)
 * if the provider supports one, so a resend after an interrupted run can't duplicate.
 *
 * @returns {import('./index').Sender}
 */
const createEmailProviderSender = () => createStubSender('emailProviderSender', 'email');

/**
 * TODO(provider): pass a provider idempotency key (e.g. `${date}:${program}:whatsapp`)
 * if the BSP supports one, so a resend after an interrupted run can't duplicate.
 *
 * @returns {import('./index').Sender}
 */
const createWhatsappProviderSender = () => createStubSender('whatsappProviderSender', 'whatsapp');

module.exports = { NOT_IMPLEMENTED, createEmailProviderSender, createWhatsappProviderSender };
