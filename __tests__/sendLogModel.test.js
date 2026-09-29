const { query } = require('../src/config/env');
const { insertSendLog, selectSendLog } = require('../src/models/sendLogModel');

jest.mock('../src/config/env', () => ({
  query: jest.fn(),
}));

beforeEach(() => {
  jest.clearAllMocks();
});

describe('insertSendLog', () => {
  test('inserts with placeholders only', async () => {
    query.mockResolvedValue([{ insertId: 7 }]);

    const result = await insertSendLog({
      date: '2026-09-28',
      program: 'time4mishna',
      channel: 'email',
      mode: 'dry-run',
      status: 'sent',
      providerMessageId: "id-with-'quote",
    });

    expect(result).toEqual({ insertId: 7 });
    const [sql, params] = query.mock.calls[0];
    expect(sql).toMatch(/INSERT INTO send_log \(send_date, program, channel, mode, status, provider_message_id\)\s+VALUES \(\?, \?, \?, \?, \?, \?\)/);
    expect(sql).not.toContain('2026-09-28');
    expect(params).toEqual(['2026-09-28', 'time4mishna', 'email', 'dry-run', 'sent', "id-with-'quote"]);
  });

  test('defaults providerMessageId to null', async () => {
    query.mockResolvedValue([{}]);
    await insertSendLog({ date: '2026-09-28', program: 'time4nach', channel: 'whatsapp', mode: 'live', status: 'failed' });
    expect(query.mock.calls[0][1]).toEqual(['2026-09-28', 'time4nach', 'whatsapp', 'live', 'failed', null]);
  });
});

describe('selectSendLog', () => {
  test('selects by date, program, channel and mode with placeholders', async () => {
    const rows = [{ send_log_id: 1, status: 'sent' }];
    query.mockResolvedValue([rows]);

    await expect(selectSendLog('2026-09-28', 'time4mishna', 'email', 'dry-run')).resolves.toBe(rows);

    const [sql, params] = query.mock.calls[0];
    expect(sql).toMatch(/FROM send_log\s+WHERE send_date = \? AND program = \? AND channel = \? AND mode = \?/);
    expect(sql).toMatch(/ORDER BY send_log_id ASC/);
    expect(params).toEqual(['2026-09-28', 'time4mishna', 'email', 'dry-run']);
  });
});
