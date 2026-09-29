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
 * @property {{ text: string }} whatsapp
 */

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
 * @param {{ text: string }} fields.whatsapp
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

  return {
    date,
    program,
    email: { subject: email.subject, html: email.html, text: email.text },
    whatsapp: { text: whatsapp.text },
  };
};

module.exports = { PROGRAMS, createDailyMessage };
