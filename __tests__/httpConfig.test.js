const { getHttpConfig } = require('../src/config/http');

describe('getHttpConfig', () => {
  test('uses the defaults when nothing is set', () => {
    expect(getHttpConfig({})).toEqual({
      windowMs: 900000,
      max: 300,
      calendarMax: 30,
      trustProxy: false,
    });
  });

  test('reads overrides', () => {
    expect(
      getHttpConfig({
        RATE_LIMIT_WINDOW_MS: '60000',
        RATE_LIMIT_MAX: '50',
        RATE_LIMIT_CALENDAR_MAX: ' 5 ',
        TRUST_PROXY: '1',
      })
    ).toEqual({ windowMs: 60000, max: 50, calendarMax: 5, trustProxy: 1 });
  });

  test('treats blank values as unset', () => {
    expect(getHttpConfig({ RATE_LIMIT_MAX: '  ', TRUST_PROXY: '' })).toMatchObject({ max: 300, trustProxy: false });
  });

  test.each(['0', '-1', '2.5', 'many'])('rejects RATE_LIMIT_MAX=%s', (value) => {
    expect(() => getHttpConfig({ RATE_LIMIT_MAX: value })).toThrow(/RATE_LIMIT_MAX must be a positive whole number/);
  });

  test.each(['-1', 'yes', '1.5'])('rejects TRUST_PROXY=%s', (value) => {
    expect(() => getHttpConfig({ TRUST_PROXY: value })).toThrow(/TRUST_PROXY must be the number of proxies/);
  });
});
