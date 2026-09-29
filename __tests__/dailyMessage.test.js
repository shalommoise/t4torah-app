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

  test('returns the DailyMessage shape for valid fields', () => {
    expect(createDailyMessage(validFields())).toEqual(validFields());
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
  ])('throws for %s', (_name, overrides) => {
    expect(() => createDailyMessage({ ...validFields(), ...overrides })).toThrow(TypeError);
  });
});
