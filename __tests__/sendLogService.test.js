const { selectSendLogByDate } = require('../src/models/sendLogModel');
const { getSendLog } = require('../src/services/sendLogService');

jest.mock('../src/models/sendLogModel', () => ({
  selectSendLogByDate: jest.fn(),
}));

// dailyContentService (for isValidGregorianDate) requires datesModel; keep the DB config unloaded.
jest.mock('../src/models/datesModel', () => ({}));

beforeEach(() => {
  jest.clearAllMocks();
});

describe('getSendLog', () => {
  test('maps rows to entries', async () => {
    const createdAt = new Date('2026-09-28T04:00:00Z');
    selectSendLogByDate.mockResolvedValue([
      {
        send_log_id: 3,
        send_date: '2026-09-28',
        program: 'time4nach',
        channel: 'whatsapp',
        mode: 'live',
        status: 'failed',
        provider_message_id: null,
        created_at: createdAt,
      },
    ]);

    await expect(getSendLog({ date: '2026-09-28' })).resolves.toEqual({
      date: '2026-09-28',
      entries: [
        {
          id: 3,
          program: 'time4nach',
          channel: 'whatsapp',
          mode: 'live',
          status: 'failed',
          providerMessageId: null,
          createdAt,
        },
      ],
    });
    expect(selectSendLogByDate).toHaveBeenCalledWith('2026-09-28');
  });

  test('returns an empty list for a date with no attempts', async () => {
    selectSendLogByDate.mockResolvedValue([]);
    await expect(getSendLog({ date: '2026-09-29' })).resolves.toEqual({ date: '2026-09-29', entries: [] });
  });

  test.each([undefined, '', '28-09-2026', '2026-02-30', "2026-09-28' OR 1=1"])(
    '400 for date %p without querying',
    async (date) => {
      await expect(getSendLog({ date })).rejects.toMatchObject({
        status: 400,
        message: 'date must be a valid date in YYYY-MM-DD format',
      });
      expect(selectSendLogByDate).not.toHaveBeenCalled();
    }
  );
});
