// Live-mode placeholders. The email provider (MailerLite / Brevo) and the
// WhatsApp BSP (Wati / AiSensy) haven't been chosen, so these senders must
// not contact anything: send() always rejects. Replace them with real
// implementations once a provider is chosen (see backlog F1 checklist).

const NOT_IMPLEMENTED = 'Not implemented: provider not chosen';

const createStubSender = (name, channel) => ({
  name,
  channel,
  send: async () => {
    throw new Error(NOT_IMPLEMENTED);
  },
});

/**
 * @returns {import('./index').Sender}
 */
const createEmailProviderSender = () => createStubSender('emailProviderSender', 'email');

/**
 * @returns {import('./index').Sender}
 */
const createWhatsappProviderSender = () => createStubSender('whatsappProviderSender', 'whatsapp');

module.exports = { NOT_IMPLEMENTED, createEmailProviderSender, createWhatsappProviderSender };
