import { FcmProvider } from './fcm.provider';

describe('FcmProvider.sendToTokensDetailed', () => {
  const makeProvider = (sendEachForMulticast: jest.Mock) => {
    const provider = new FcmProvider({} as never);
    // Bypass onModuleInit (needs real Firebase credentials) and inject a
    // fake Messaging client directly for these unit tests.
    (provider as any).messaging = { sendEachForMulticast };
    return provider;
  };

  it('returns an empty array without calling FCM when there are no tokens', async () => {
    const sendEachForMulticast = jest.fn();
    const provider = makeProvider(sendEachForMulticast);

    await expect(provider.sendToTokensDetailed([], { title: 't', body: 'b' })).resolves.toEqual([]);
    expect(sendEachForMulticast).not.toHaveBeenCalled();
  });

  it('maps a successful response to an accepted result per token', async () => {
    const sendEachForMulticast = jest.fn().mockResolvedValue({
      successCount: 2,
      failureCount: 0,
      responses: [{ success: true }, { success: true }],
    });
    const provider = makeProvider(sendEachForMulticast);

    const results = await provider.sendToTokensDetailed(['tok-1', 'tok-2'], { title: 't', body: 'b' });

    expect(results).toEqual([
      { provider: 'fcm', token: 'tok-1', accepted: true, permanentFailure: false },
      { provider: 'fcm', token: 'tok-2', accepted: true, permanentFailure: false },
    ]);
  });

  it('flags a not-registered token as a permanent failure, and other errors as transient', async () => {
    const sendEachForMulticast = jest.fn().mockResolvedValue({
      successCount: 0,
      failureCount: 2,
      responses: [
        { success: false, error: { code: 'messaging/registration-token-not-registered', message: 'gone' } },
        { success: false, error: { code: 'messaging/internal-error', message: 'try again' } },
      ],
    });
    const provider = makeProvider(sendEachForMulticast);

    const results = await provider.sendToTokensDetailed(['tok-dead', 'tok-flaky'], { title: 't', body: 'b' });

    expect(results[0]).toEqual(
      expect.objectContaining({ token: 'tok-dead', accepted: false, permanentFailure: true }),
    );
    expect(results[1]).toEqual(
      expect.objectContaining({ token: 'tok-flaky', accepted: false, permanentFailure: false }),
    );
  });

  it('chunks into multiple multicast calls above 500 tokens', async () => {
    const sendEachForMulticast = jest.fn().mockImplementation(({ tokens }) => ({
      successCount: tokens.length,
      failureCount: 0,
      responses: tokens.map(() => ({ success: true })),
    }));
    const provider = makeProvider(sendEachForMulticast);
    const tokens = Array.from({ length: 750 }, (_, i) => `tok-${i}`);

    const results = await provider.sendToTokensDetailed(tokens, { title: 't', body: 'b' });

    expect(sendEachForMulticast).toHaveBeenCalledTimes(2);
    expect(results).toHaveLength(750);
  });

  it('marks every token in a chunk as a non-permanent failure when the whole request throws', async () => {
    const sendEachForMulticast = jest.fn().mockRejectedValue(new Error('network down'));
    const provider = makeProvider(sendEachForMulticast);

    const results = await provider.sendToTokensDetailed(['tok-1', 'tok-2'], { title: 't', body: 'b' });

    expect(results).toEqual([
      expect.objectContaining({ token: 'tok-1', accepted: false, permanentFailure: false }),
      expect.objectContaining({ token: 'tok-2', accepted: false, permanentFailure: false }),
    ]);
  });

  it('sendToTokens (legacy count-only) still returns the accepted count', async () => {
    const sendEachForMulticast = jest.fn().mockResolvedValue({
      successCount: 1,
      failureCount: 1,
      responses: [{ success: true }, { success: false, error: { code: 'messaging/internal-error' } }],
    });
    const provider = makeProvider(sendEachForMulticast);

    await expect(
      provider.sendToTokens(['tok-1', 'tok-2'], { title: 't', body: 'b' }),
    ).resolves.toBe(1);
  });

  it('isEnabled reflects whether Firebase was actually initialized', () => {
    const provider = new FcmProvider({ get: () => undefined } as never);
    expect(provider.isEnabled()).toBe(false);
  });
});
