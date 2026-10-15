// Unicode code points, matching the WhatsApp renderer's limit.
const countChars = (text) => Array.from(text).length;

/**
 * Dry-run sender that logs a one-line summary of each message instead of
 * sending it.
 *
 * @param {'email'|'whatsapp'} channel
 * @param {{ logger?: { log: (line: string) => void } }} [config]
 * @returns {import('./index').Sender}
 */
const createConsoleSender = (channel, config = {}) => {
  const logger = config.logger || console;

  return {
    name: `console-${channel}`,
    channel,
    send: async (message) => {
      try {
        const attachmentCount = (message.whatsapp && message.whatsapp.attachments ? message.whatsapp.attachments : []).length;
        const detail =
          channel === 'email'
            ? `"${message.email.subject}" (${countChars(message.email.text)} chars text, ${countChars(message.email.html)} chars html)`
            : `(${countChars(message.whatsapp.text)} chars${
                attachmentCount ? `, ${attachmentCount} attachments` : ''
              })`;
        logger.log(`[dry-run] ${channel} ${message.program} ${message.date}: ${detail}`);
        return { ok: true, id: `console-${channel}-${message.program}-${message.date}` };
      } catch (error) {
        return { ok: false, error: error.message };
      }
    },
  };
};

module.exports = { createConsoleSender };
