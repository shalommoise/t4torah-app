/**
 * @typedef {'time4mishna'|'time4nach'|'combined'} DailyMessageProgram
 */

/**
 * A rendered daily message, ready to hand to a sender.
 *
 * @typedef {object} DailyMessage
 * @property {string} date Gregorian date, `YYYY-MM-DD`.
 * @property {DailyMessageProgram} program
 * @property {{ subject: string, html: string, text: string }} email
 * @property {{ text: string, attachments: WhatsappAttachment[] }} whatsapp
 */

/**
 * A file sent alongside the WhatsApp text (the provider fetches it by URL).
 *
 * @typedef {object} WhatsappAttachment
 * @property {'audio'|'document'} type
 * @property {string} url Public URL of the file.
 * @property {string} filename Name shown to the recipient.
 */

const ATTACHMENT_TYPES = ['audio', 'document'];

const isValidAttachment = (attachment) =>
  Boolean(attachment) &&
  ATTACHMENT_TYPES.includes(attachment.type) &&
  typeof attachment.url === 'string' &&
  /^https?:\/\//.test(attachment.url) &&
  typeof attachment.filename === 'string' &&
  attachment.filename.length > 0;

/** @type {DailyMessageProgram[]} */
const PROGRAMS = ['time4mishna', 'time4nach', 'combined'];

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const isString = (value) => typeof value === 'string';

/**
 * Builds a DailyMessage, throwing a TypeError if any field is missing or of
 * the wrong type, so renderer bugs surface before anything reaches a sender.
 *
 * @param {object} fields
 * @param {string} fields.date
 * @param {DailyMessageProgram} fields.program
 * @param {{ subject: string, html: string, text: string }} fields.email
 * @param {{ text: string, attachments?: WhatsappAttachment[] }} fields.whatsapp  `attachments` defaults to [].
 * @returns {DailyMessage}
 */
const createDailyMessage = ({ date, program, email, whatsapp } = {}) => {
  if (!isString(date) || !DATE_PATTERN.test(date)) {
    throw new TypeError('DailyMessage.date must be a YYYY-MM-DD string');
  }
  if (!PROGRAMS.includes(program)) {
    throw new TypeError(`DailyMessage.program must be one of: ${PROGRAMS.join(', ')}`);
  }
  if (!email || !isString(email.subject) || !isString(email.html) || !isString(email.text)) {
    throw new TypeError('DailyMessage.email must have string subject, html and text');
  }
  if (!whatsapp || !isString(whatsapp.text)) {
    throw new TypeError('DailyMessage.whatsapp must have a string text');
  }
  const attachments = whatsapp.attachments === undefined ? [] : whatsapp.attachments;
  if (!Array.isArray(attachments) || !attachments.every(isValidAttachment)) {
    throw new TypeError(
      'DailyMessage.whatsapp.attachments must be { type: audio|document, url: http(s) URL, filename } objects'
    );
  }

  return {
    date,
    program,
    email: { subject: email.subject, html: email.html, text: email.text },
    whatsapp: {
      text: whatsapp.text,
      attachments: attachments.map(({ type, url, filename }) => ({ type, url, filename })),
    },
  };
};

module.exports = { PROGRAMS, createDailyMessage };
