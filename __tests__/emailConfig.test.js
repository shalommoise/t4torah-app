const { getEmailConfig } = require('../src/config/email');

describe('getEmailConfig', () => {
  test('everything null when nothing is set', () => {
    expect(getEmailConfig({})).toEqual({ bucketUrl: null, assetsUrl: null, unsubscribeUrl: null });
  });

  test('assets default to <bucket>/email and trailing slashes are removed', () => {
    expect(getEmailConfig({ BUCKET_PATH: 'https://bucket.test/t4t/ ' })).toEqual({
      bucketUrl: 'https://bucket.test/t4t',
      assetsUrl: 'https://bucket.test/t4t/email',
      unsubscribeUrl: null,
    });
  });

  test('EMAIL_ASSETS_URL and EMAIL_UNSUBSCRIBE_URL override', () => {
    expect(
      getEmailConfig({
        BUCKET_PATH: 'https://bucket.test',
        EMAIL_ASSETS_URL: 'https://cdn.test/img/',
        EMAIL_UNSUBSCRIBE_URL: '{$unsubscribe}',
      })
    ).toEqual({ bucketUrl: 'https://bucket.test', assetsUrl: 'https://cdn.test/img', unsubscribeUrl: '{$unsubscribe}' });
  });

  test('blank values count as unset', () => {
    expect(getEmailConfig({ BUCKET_PATH: '  ', EMAIL_UNSUBSCRIBE_URL: '' })).toEqual({
      bucketUrl: null,
      assetsUrl: null,
      unsubscribeUrl: null,
    });
  });
});
