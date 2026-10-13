const { getDailyContent } = require('../src/services/dailyContentService');
const sendLogModel = require('../src/models/sendLogModel');
const { getSenders } = require('../src/services/senders');
const { getSendPreview } = require('../src/services/sendPreviewService');

jest.mock('../src/services/dailyContentService', () => ({
  getDailyContent: jest.fn(),
}));

jest.mock('../src/models/sendLogModel', () => ({
  claimSendLog: jest.fn(),
  reclaimFailedSendLog: jest.fn(),
  forceClaimSendLog: jest.fn(),
  finishSendLog: jest.fn(),
  selectSendLog: jest.fn(),
  selectSendLogByDate: jest.fn(),
}));

jest.mock('../src/services/senders', () => ({
  ...jest.requireActual('../src/services/senders'),
  getSenders: jest.fn(),
}));

const dateRow = (overrides) => ({
  date_id: 1,
  gregorian_date: '2026-09-28',
  hebrew_date: '17 Tishrei 5787',
  hebrew_date_he: 'י״ז תשרי תשפ״ז',
  day_of_week: 'Monday',
  is_yom_tov: 0,
  special_date: null,
  ...overrides,
});

const content = (overrides) => ({
  date: dateRow(),
  time4mishna: [
    {
      shiur_type: 'regular',
      start_masechta_id: 1,
      start_masechta_name: 'Brachos',
      start_perek: 1,
      start_mishna_number: 1,
      end_masechta_id: 1,
      end_masechta_name: 'Brachos',
      end_perek: 1,
      end_mishna_number: 4,
      additional_notice: null,
    },
  ],
  time4nach: [{ shiur_type: 'regular', sefer_name: 'Tehillim', perek: 42, additional_notice: null }],
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe('getSendPreview', () => {
  test('renders both channels for time4mishna by default', async () => {
    getDailyContent.mockResolvedValue(content());

    const preview = await getSendPreview({ date: '2026-09-28' });

    expect(getDailyContent).toHaveBeenCalledWith('2026-09-28');
    expect(preview).toMatchObject({ date: '2026-09-28', program: 'time4mishna', sendDay: true });
    expect(preview.email.subject).toBe('Time4Mishna – Monday 28 Sep | 17 Tishrei');
    expect(preview.email.html).toContain('Brachos 1:1–1:4');
    expect(preview.email.text).toContain('Brachos 1:1–1:4');
    expect(preview.whatsapp.text).toContain('*Brachos 1:1–1:4*');
  });

  test('only the requested channel', async () => {
    getDailyContent.mockResolvedValue(content());
    const email = await getSendPreview({ date: '2026-09-28', channel: 'email', program: 'time4nach' });
    expect(email).not.toHaveProperty('whatsapp');
    expect(email.email.html).toContain('Tehillim 42');

    const whatsapp = await getSendPreview({ date: '2026-09-28', channel: 'whatsapp', program: 'combined' });
    expect(whatsapp).not.toHaveProperty('email');
    expect(whatsapp.whatsapp.text).toContain('*Tehillim 42*');
  });

  test('previews a non-send day with sendDay false', async () => {
    getDailyContent.mockResolvedValue(content({ date: dateRow({ day_of_week: 'Shabbos' }) }));
    await expect(getSendPreview({ date: '2026-10-03' })).resolves.toMatchObject({ sendDay: false });
  });

  test('never builds senders or touches the send log', async () => {
    getDailyContent.mockResolvedValue(content());
    await getSendPreview({ date: '2026-09-28' });
    expect(getSenders).not.toHaveBeenCalled();
    Object.values(sendLogModel).forEach((fn) => expect(fn).not.toHaveBeenCalled());
  });

  test.each([
    [{ program: 'daf-yomi' }, 'program must be one of: time4mishna, time4nach, combined'],
    [{ program: '' }, 'program must be one of'],
    [{ channel: 'sms' }, 'channel must be one of: email, whatsapp'],
    [{ channel: '' }, 'channel must be one of'],
  ])('400 for %p without looking up content', async (options, message) => {
    await expect(getSendPreview({ date: '2026-09-28', ...options })).rejects.toMatchObject({ status: 400, message: expect.stringContaining(message) });
    expect(getDailyContent).not.toHaveBeenCalled();
  });

  test('404 when the date is not in dates_table', async () => {
    getDailyContent.mockResolvedValue(null);
    await expect(getSendPreview({ date: '2030-01-01' })).rejects.toMatchObject({
      status: 404,
      message: 'No date row for 2030-01-01',
    });
  });

  test('passes through the 400 for an invalid date', async () => {
    const error = Object.assign(new Error('bad date'), { status: 400 });
    getDailyContent.mockRejectedValue(error);
    await expect(getSendPreview({ date: 'nope' })).rejects.toBe(error);
  });
});
