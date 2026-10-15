const fs = require('fs/promises');
const path = require('path');
const { createDailyMessage } = require('../render/dailyMessage');

const DEFAULT_OUTBOX_DIR = 'outbox';

/**
 * Files to write for a message on a channel, relative to the day's outbox
 * folder. Email gets `.html` plus a `.txt` with the subject on top; WhatsApp
 * gets `.txt`, with any attachments listed after the text.
 */
const getOutboxFiles = (channel, message) => {
  const base = `${channel}-${message.program}`;
  if (channel === 'email') {
    return [
      { name: `${base}.html`, content: message.email.html },
      { name: `${base}.txt`, content: `Subject: ${message.email.subject}\n\n${message.email.text}` },
    ];
  }
  const { text, attachments } = message.whatsapp;
  const attachmentLines = attachments.map((file) => `- ${file.type}: ${file.filename} (${file.url})`);
  const content = attachments.length ? `${text}\n\n--- attachments ---\n${attachmentLines.join('\n')}\n` : text;
  return [{ name: `${base}.txt`, content }];
};

/**
 * Dry-run sender that writes each message to
 * `<outboxDir>/<date>/<channel>-<program>.{html,txt}` (`outbox/` is gitignored).
 * The result `id` is the path of the first file written.
 *
 * @param {'email'|'whatsapp'} channel
 * @param {{ outboxDir?: string }} [config] `outboxDir` defaults to `outbox`,
 *   resolved against the working directory.
 * @returns {import('./index').Sender}
 */
const createFileSender = (channel, config = {}) => {
  const outboxDir = path.resolve(process.cwd(), config.outboxDir || DEFAULT_OUTBOX_DIR);

  return {
    name: `file-${channel}`,
    channel,
    send: async (message) => {
      try {
        // Validates date and program before they become part of a path.
        const validMessage = createDailyMessage(message);
        const dayDir = path.join(outboxDir, validMessage.date);
        await fs.mkdir(dayDir, { recursive: true });

        const files = getOutboxFiles(channel, validMessage);
        const paths = [];
        for (const file of files) {
          const filePath = path.join(dayDir, file.name);
          await fs.writeFile(filePath, file.content, 'utf8');
          paths.push(filePath);
        }
        return { ok: true, id: paths[0] };
      } catch (error) {
        return { ok: false, error: error.message };
      }
    },
  };
};

module.exports = { createFileSender };
