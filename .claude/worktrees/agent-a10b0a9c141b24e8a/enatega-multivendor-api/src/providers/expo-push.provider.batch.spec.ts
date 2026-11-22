import axios from 'axios';
import { ExpoPushProvider } from './expo-push.provider';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('ExpoPushProvider.sendBatch', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns an empty array without an HTTP call for an empty message list', async () => {
    const provider = new ExpoPushProvider();
    await expect(provider.sendBatch([])).resolves.toEqual([]);
    expect(mockedAxios.post).not.toHaveBeenCalled();
  });

  it('sends every message in a single request when under the 100-message limit', async () => {
    mockedAxios.post.mockResolvedValue({
      data: { data: [{ status: 'ok', id: 't1' }, { status: 'ok', id: 't2' }] },
    });
    const provider = new ExpoPushProvider();
    const messages = [
      { to: 'tok-1', title: 't', body: 'b', priority: 'high' as const, channelId: 'c', data: {} },
      { to: 'tok-2', title: 't', body: 'b', priority: 'high' as const, channelId: 'c', data: {} },
    ];

    const results = await provider.sendBatch(messages);

    expect(mockedAxios.post).toHaveBeenCalledTimes(1);
    expect(mockedAxios.post).toHaveBeenCalledWith(
      'https://exp.host/--/api/v2/push/send',
      messages,
      expect.any(Object),
    );
    expect(results).toEqual([
      expect.objectContaining({ token: 'tok-1', accepted: true }),
      expect.objectContaining({ token: 'tok-2', accepted: true }),
    ]);
  });

  it('chunks into multiple requests above the 100-message limit, preserving result order', async () => {
    mockedAxios.post.mockImplementation((_url, body) =>
      Promise.resolve({
        data: { data: (body as unknown[]).map(() => ({ status: 'ok' })) },
      }),
    );
    const provider = new ExpoPushProvider();
    const messages = Array.from({ length: 250 }, (_, i) => ({
      to: `tok-${i}`,
      title: 't',
      body: 'b',
      priority: 'high' as const,
      channelId: 'c',
      data: {},
    }));

    const results = await provider.sendBatch(messages);

    expect(mockedAxios.post).toHaveBeenCalledTimes(3); // 100 + 100 + 50
    expect(results).toHaveLength(250);
    expect(results[0].token).toBe('tok-0');
    expect(results[249].token).toBe('tok-249');
  });

  it('maps a per-message DeviceNotRegistered error to a permanent failure', async () => {
    mockedAxios.post.mockResolvedValue({
      data: {
        data: [
          { status: 'ok' },
          { status: 'error', message: 'gone', details: { error: 'DeviceNotRegistered' } },
        ],
      },
    });
    const provider = new ExpoPushProvider();
    const messages = [
      { to: 'tok-ok', title: 't', body: 'b', priority: 'high' as const, channelId: 'c', data: {} },
      { to: 'tok-dead', title: 't', body: 'b', priority: 'high' as const, channelId: 'c', data: {} },
    ];

    const results = await provider.sendBatch(messages);

    expect(results[0]).toEqual(expect.objectContaining({ token: 'tok-ok', accepted: true }));
    expect(results[1]).toEqual(
      expect.objectContaining({ token: 'tok-dead', accepted: false, permanentFailure: true }),
    );
  });

  it('marks every message in a failed chunk as a non-permanent failure', async () => {
    mockedAxios.post.mockRejectedValue(new Error('timeout'));
    const provider = new ExpoPushProvider();
    const messages = [
      { to: 'tok-1', title: 't', body: 'b', priority: 'high' as const, channelId: 'c', data: {} },
      { to: 'tok-2', title: 't', body: 'b', priority: 'high' as const, channelId: 'c', data: {} },
    ];

    const results = await provider.sendBatch(messages);

    expect(results).toEqual([
      expect.objectContaining({ token: 'tok-1', accepted: false, permanentFailure: false }),
      expect.objectContaining({ token: 'tok-2', accepted: false, permanentFailure: false }),
    ]);
  });
});
