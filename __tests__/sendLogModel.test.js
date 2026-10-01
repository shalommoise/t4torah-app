const { query } = require('../src/config/env');
const {
  claimSendLog,
  reclaimFailedSendLog,
  forceClaimSendLog,
  finishSendLog,
  selectSendLog,
  selectSendLogByDate,
} = require('../src/models/sendLogModel');

jest.mock('../src/config/env', () => ({
  query: jest.fn(),
}));

beforeEach(() => {
  jest.clearAllMocks();
});

const key = { date: '2026-09-28', program: 'time4mishna', channel: 'email', mode: 'dry-run' };
const keyParams = ['2026-09-28', 'time4mishna', 'email', 'dry-run'];
const KEY_WHERE = /WHERE send_date = \? AND program = \? AND channel = \? AND mode = \?/;

describe('claimSendLog', () => {
  test('inserts a claimed row with placeholders and returns true', async () => {
    query.mockResolvedValue([{ affectedRows: 1, insertId: 7 }]);

    await expect(claimSendLog(key)).resolves.toBe(true);

    const [sql, params] = query.mock.calls[0];
    expect(sql).toMatch(/INSERT INTO send_log \(send_date, program, channel, mode, status, attempts\)\s+VALUES \(\?, \?, \?, \?, 'claimed', 1\)/);
    expect(sql).not.toMatch(/IGNORE|ON DUPLICATE/);
    expect(params).toEqual(keyParams);
  });

  test('returns false on a duplicate key (already claimed)', async () => {
    query.mockRejectedValue(Object.assign(new Error('Duplicate entry'), { code: 'ER_DUP_ENTRY', errno: 1062 }));
    await expect(claimSendLog(key)).resolves.toBe(false);
  });

  test('rethrows any other error', async () => {
    const error = Object.assign(new Error('gone away'), { code: 'PROTOCOL_CONNECTION_LOST' });
    query.mockRejectedValue(error);
    await expect(claimSendLog(key)).rejects.toBe(error);
  });
});

describe('reclaimFailedSendLog', () => {
  test('flips only a failed row to claimed, counting the attempt', async () => {
    query.mockResolvedValue([{ affectedRows: 1 }]);

    await expect(reclaimFailedSendLog(key)).resolves.toBe(true);

    const [sql, params] = query.mock.calls[0];
    expect(sql).toMatch(/UPDATE send_log\s+SET status = 'claimed', attempts = attempts \+ 1, provider_message_id = NULL/);
    expect(sql).toMatch(KEY_WHERE);
    expect(sql).toMatch(/AND status = 'failed'/);
    expect(params).toEqual(keyParams);
  });

  test('returns false unless exactly one row changed', async () => {
    query.mockResolvedValue([{ affectedRows: 0 }]);
    await expect(reclaimFailedSendLog(key)).resolves.toBe(false);
  });
});

describe('forceClaimSendLog', () => {
  test('upserts a claimed row', async () => {
    query.mockResolvedValue([{ affectedRows: 2 }]);

    await expect(forceClaimSendLog(key)).resolves.toBe(true);

    const [sql, params] = query.mock.calls[0];
    expect(sql).toMatch(/VALUES \(\?, \?, \?, \?, 'claimed', 1\)\s+ON DUPLICATE KEY UPDATE status = 'claimed', attempts = attempts \+ 1, provider_message_id = NULL/);
    expect(params).toEqual(keyParams);
  });
});

describe('finishSendLog', () => {
  test('sets the outcome only on a claimed row', async () => {
    query.mockResolvedValue([{ affectedRows: 1 }]);

    await expect(finishSendLog(key, { status: 'sent', providerMessageId: "id-with-'quote" })).resolves.toBe(true);

    const [sql, params] = query.mock.calls[0];
    expect(sql).toMatch(/UPDATE send_log\s+SET status = \?, provider_message_id = \?/);
    expect(sql).toMatch(KEY_WHERE);
    expect(sql).toMatch(/AND status = 'claimed'/);
    expect(sql).not.toContain("id-with-'quote");
    expect(params).toEqual(['sent', "id-with-'quote", ...keyParams]);
  });

  test('defaults providerMessageId to null and returns false if the row was not claimed', async () => {
    query.mockResolvedValue([{ affectedRows: 0 }]);
    await expect(finishSendLog(key, { status: 'failed' })).resolves.toBe(false);
    expect(query.mock.calls[0][1]).toEqual(['failed', null, ...keyParams]);
  });
});

describe('selectSendLog', () => {
  test('selects the row for a key with placeholders', async () => {
    const rows = [{ send_log_id: 1, status: 'sent' }];
    query.mockResolvedValue([rows]);

    await expect(selectSendLog(key)).resolves.toBe(rows);

    const [sql, params] = query.mock.calls[0];
    expect(sql).toMatch(/SELECT \* FROM send_log WHERE send_date = \? AND program = \? AND channel = \? AND mode = \?/);
    expect(params).toEqual(keyParams);
  });
});

describe('selectSendLogByDate', () => {
  test('selects every attempt for a date with a placeholder', async () => {
    const rows = [{ send_log_id: 1 }, { send_log_id: 2 }];
    query.mockResolvedValue([rows]);

    await expect(selectSendLogByDate('2026-09-28')).resolves.toBe(rows);

    const [sql, params] = query.mock.calls[0];
    expect(sql).toMatch(/FROM send_log\s+WHERE send_date = \?\s+ORDER BY send_log_id ASC/);
    expect(params).toEqual(['2026-09-28']);
  });
});
