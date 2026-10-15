const { PROGRAMS, createDailyMessage } = require('../src/services/render/dailyMessage');

const validFields = () => ({
  date: '2026-09-28',
  program: 'time4mishna',
  email: { subject: 'Subject', html: '<p>Hi</p>', text: 'Hi' },
  whatsapp: { text: '*Hi*' },
});

describe('createDailyMessage', () => {
  test('lists the supported programs', () => {
    expect(PROGRAMS).toEqual(['time4mishna', 'time4nach', 'combined']);
  });

  test('returns the DailyMessage shape for valid fields, defaulting attachments to []', () => {
    const expected = validFields();
    expected.whatsapp.attachments = [];
    expect(createDailyMessage(validFields())).toEqual(expected);
  });

  test('keeps valid WhatsApp attachments', () => {
    const attachments = [
      { type: 'audio', url: 'https://bucket.test/a.mp3', filename: 'a.mp3' },
      { type: 'document', url: 'https://bucket.test/a.pdf', filename: 'a.pdf' },
    ];
    const message = createDailyMessage({ ...validFields(), whatsapp: { text: 'x', attachments } });
    expect(message.whatsapp.attachments).toEqual(attachments);
  });

  test('drops unknown fields', () => {
    const fields = validFields();
    fields.extra = 1;
    fields.email.cc = 'x';
    const message = createDailyMessage(fields);
    expect(message).not.toHaveProperty('extra');
    expect(message.email).not.toHaveProperty('cc');
  });

  test.each(PROGRAMS)('accepts program %s', (program) => {
    expect(createDailyMessage({ ...validFields(), program }).program).toBe(program);
  });

  test('throws with no fields', () => {
    expect(() => createDailyMessage()).toThrow(TypeError);
  });

  test.each([
    ['bad date', { date: '28/09/2026' }],
    ['unknown program', { program: 'daf-yomi' }],
    ['missing email', { email: undefined }],
    ['email missing html', { email: { subject: 's', text: 't' } }],
    ['missing whatsapp', { whatsapp: undefined }],
    ['non-string whatsapp text', { whatsapp: { text: 5 } }],
    ['attachments not an array', { whatsapp: { text: 'x', attachments: 'a.mp3' } }],
    ['unknown attachment type', { whatsapp: { text: 'x', attachments: [{ type: 'video', url: 'https://b/a', filename: 'a' }] } }],
    ['non-http attachment url', { whatsapp: { text: 'x', attachments: [{ type: 'audio', url: '/local/a.mp3', filename: 'a' }] } }],
    ['attachment without filename', { whatsapp: { text: 'x', attachments: [{ type: 'audio', url: 'https://b/a.mp3' }] } }],
  ])('throws for %s', (_name, overrides) => {
    expect(() => createDailyMessage({ ...validFields(), ...overrides })).toThrow(TypeError);
  });
});
