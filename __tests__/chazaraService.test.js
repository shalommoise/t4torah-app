const { getChazara } = require('../src/services/chazaraService');

jest.mock('../src/services/dailyContentService', () => ({
  getDailyContent: jest.fn(() => {
    throw new Error('tests pass getContent');
  }),
}));

const BUCKET = 'https://bucket.test';

const day = (gregorianDate, dayOfWeek, notice, shiurType = 'chazara') => ({
  date: { gregorian_date: gregorianDate, day_of_week: dayOfWeek, is_yom_tov: 0 },
  time4mishna: [{ shiur_type: shiurType, additional_notice: notice }],
  time4nach: [],
});

const friday = day('2026-11-13', 'Friday', 'Shabbos 22.6 - Eiruvin 1.9');
const shabbos = day('2026-11-14', 'Shabbos', 'Shabbos 7-8 ');

describe('getChazara', () => {
  test('returns the range, perakim and links once every PDF exists', async () => {
    const getContent = jest.fn().mockResolvedValue(shabbos);
    const exists = jest.fn().mockResolvedValue(true);

    await expect(getChazara(friday, { bucketUrl: BUCKET }, { getContent, exists })).resolves.toEqual({
      range: 'Shabbos 22.6 - Eiruvin 1.9',
      perakim: 'Shabbos 7-8',
      links: {
        text: `${BUCKET}/mishna/chazara/shabbos_22.6-eiruvin_1.9_text.pdf`,
        summary: `${BUCKET}/mishna/chazara/shabbos_22.6-eiruvin_1.9_summary.pdf`,
        perakim: `${BUCKET}/mishna/chazara/shabbos_7-8.pdf`,
      },
    });
    expect(getContent).toHaveBeenCalledWith('2026-11-14');
    expect(exists).toHaveBeenCalledTimes(3);
  });

  test('is null on a day that is not a chazara Friday, without any lookups', async () => {
    const getContent = jest.fn();
    const exists = jest.fn();
    const thursday = day('2026-11-12', 'Thursday', null, 'regular');

    await expect(getChazara(thursday, { bucketUrl: BUCKET }, { getContent, exists })).resolves.toBeNull();
    expect(getContent).not.toHaveBeenCalled();
    expect(exists).not.toHaveBeenCalled();
  });

  test('throws when the TEXT PDF is missing', async () => {
    const exists = jest.fn(async (url) => !url.endsWith('_text.pdf'));

    await expect(
      getChazara(friday, { bucketUrl: BUCKET }, { getContent: async () => shabbos, exists })
    ).rejects.toThrow(
      `Chazara TEXT PDF not found in the bucket: ${BUCKET}/mishna/chazara/shabbos_22.6-eiruvin_1.9_text.pdf`
    );
  });

  test('leaves out summaries that are not in the bucket', async () => {
    const exists = jest.fn(async (url) => url.endsWith('_text.pdf'));

    const chazara = await getChazara(friday, { bucketUrl: BUCKET }, { getContent: async () => shabbos, exists });

    expect(chazara).toEqual({
      range: 'Shabbos 22.6 - Eiruvin 1.9',
      perakim: 'Shabbos 7-8',
      links: { text: `${BUCKET}/mishna/chazara/shabbos_22.6-eiruvin_1.9_text.pdf`, summary: null, perakim: null },
    });
  });

  test('checks only the range PDFs when Shabbos has no perakim', async () => {
    const exists = jest.fn().mockResolvedValue(true);
    const chazara = await getChazara(friday, { bucketUrl: BUCKET }, { getContent: async () => null, exists });
    expect(chazara.perakim).toBeNull();
    expect(chazara.links.perakim).toBeNull();
    expect(exists).toHaveBeenCalledTimes(2);
  });

  test('throws without a bucket URL', async () => {
    await expect(
      getChazara(friday, { bucketUrl: null }, { getContent: async () => shabbos, exists: async () => true })
    ).rejects.toThrow('BUCKET_PATH');
  });
});
