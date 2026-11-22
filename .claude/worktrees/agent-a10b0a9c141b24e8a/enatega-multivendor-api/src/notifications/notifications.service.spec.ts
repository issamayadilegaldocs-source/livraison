import { NotificationsService } from './notifications.service';

describe('NotificationsService dispatch pushes', () => {
  const makeService = ({
    send = jest.fn().mockResolvedValue({
      provider: 'expo',
      token: 'expo-token',
      accepted: true,
      permanentFailure: false,
    }),
    sendBatch = jest.fn().mockImplementation((messages: { to: string }[]) =>
      Promise.resolve(
        messages.map((m) => ({
          provider: 'expo',
          token: m.to,
          accepted: true,
          permanentFailure: false,
        })),
      ),
    ),
    recordDeliveryResult = jest.fn(),
  }: {
    send?: jest.Mock;
    sendBatch?: jest.Mock;
    recordDeliveryResult?: jest.Mock;
  } = {}) =>
    new NotificationsService(
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      { send, sendBatch } as never,
      {} as never,
      { recordDeliveryResult } as never,
    );

  it('preserves the nearby-order Expo payload shape, sent as a single batch', async () => {
    const sendBatch = jest.fn().mockResolvedValue([
      { provider: 'expo', token: 'expo-token', accepted: true, permanentFailure: false },
    ]);
    const service = makeService({ sendBatch });

    await expect(
      service.sendNearbyOrderPushes(
        [{ riderId: 'rider-1', notificationToken: 'expo-token' }],
        { orderId: 'order-1', restaurantName: 'Löwenstadt Pizza' },
      ),
    ).resolves.toBe(1);

    expect(sendBatch).toHaveBeenCalledWith([
      {
        to: 'expo-token',
        title: '📦 Commande disponible',
        body: 'Löwenstadt Pizza — commandez maintenant',
        priority: 'high',
        channelId: 'incoming_call',
        data: { type: 'NEARBY_ORDER', orderId: 'order-1' },
      },
    ]);
  });

  it('preserves the incoming-order Expo payload shape', async () => {
    const send = jest.fn().mockResolvedValue({
      provider: 'expo',
      token: 'expo-token',
      accepted: true,
      permanentFailure: false,
    });
    const service = makeService({ send });

    await expect(
      service.sendIncomingOrderPushToRider({
        riderId: 'rider-1',
        notificationToken: 'expo-token',
        orderId: 'order-1',
        restaurantName: 'Löwenstadt Pizza',
        orderAmount: 42,
      }),
    ).resolves.toBe(true);

    expect(send).toHaveBeenCalledWith({
      to: 'expo-token',
      title: '📦 Nouvelle commande',
      body: 'Löwenstadt Pizza — 42',
      priority: 'high',
      channelId: 'incoming_call',
      data: { type: 'INCOMING_ORDER', orderId: 'order-1' },
    });
  });

  it('counts only provider-accepted nearby-order tickets', async () => {
    const recordDeliveryResult = jest.fn();
    const sendBatch = jest.fn().mockResolvedValue([
      { provider: 'expo', token: 'expo-token-1', accepted: true, permanentFailure: false },
      {
        provider: 'expo',
        token: 'expo-token-2',
        accepted: false,
        permanentFailure: true,
        errorCode: 'DeviceNotRegistered',
      },
    ]);
    const service = makeService({ sendBatch, recordDeliveryResult });

    await expect(
      service.sendNearbyOrderPushes(
        [
          { riderId: 'rider-1', notificationToken: 'expo-token-1' },
          { riderId: 'rider-2', notificationToken: 'expo-token-2' },
        ],
        { orderId: 'order-1', restaurantName: 'Löwenstadt Pizza' },
      ),
    ).resolves.toBe(1);

    expect(recordDeliveryResult).toHaveBeenCalledWith({
      provider: 'expo',
      token: 'expo-token-2',
      accepted: false,
      permanentFailure: true,
      errorCode: 'DeviceNotRegistered',
    });
  });

  it('records incoming-order permanent token failures for hygiene', async () => {
    const recordDeliveryResult = jest.fn();
    const send = jest.fn().mockResolvedValue({
      provider: 'expo',
      token: 'expo-token',
      accepted: false,
      permanentFailure: true,
      errorCode: 'DeviceNotRegistered',
    });
    const service = makeService({ send, recordDeliveryResult });

    await expect(
      service.sendIncomingOrderPushToRider({
        riderId: 'rider-1',
        notificationToken: 'expo-token',
        orderId: 'order-1',
        restaurantName: 'Löwenstadt Pizza',
      }),
    ).resolves.toBe(false);

    expect(recordDeliveryResult).toHaveBeenCalledWith({
      provider: 'expo',
      token: 'expo-token',
      accepted: false,
      permanentFailure: true,
      errorCode: 'DeviceNotRegistered',
    });
  });
});

// Regression: sendPushToUser previously called fcmProvider.sendToTokens,
// which only returns a count — a dead customer token (uninstalled app,
// superseded registration) never fed back into token hygiene, so it
// stayed "active" and kept being retried forever. Only the rider/Expo
// path was cleaning up bad tokens; this is the FCM/customer path.
describe('NotificationsService.sendPushToUser', () => {
  const makeService = ({
    getUserTokens = jest.fn().mockResolvedValue([{ token: 'fcm-token-1' }]),
    sendToTokensDetailed = jest.fn().mockResolvedValue([
      { provider: 'fcm', token: 'fcm-token-1', accepted: true, permanentFailure: false },
    ]),
    sendBatch = jest.fn().mockImplementation((messages: { to: string }[]) =>
      Promise.resolve(
        messages.map((m) => ({ provider: 'expo', token: m.to, accepted: true, permanentFailure: false })),
      ),
    ),
    recordDeliveryResult = jest.fn(),
    userNotificationsCreate = jest.fn().mockResolvedValue(undefined),
  }: {
    getUserTokens?: jest.Mock;
    sendToTokensDetailed?: jest.Mock;
    sendBatch?: jest.Mock;
    recordDeliveryResult?: jest.Mock;
    userNotificationsCreate?: jest.Mock;
  } = {}) =>
    new NotificationsService(
      {} as never,
      {} as never,
      { getUserTokens } as never,
      { sendToTokensDetailed } as never,
      { sendBatch } as never,
      { create: userNotificationsCreate } as never,
      { recordDeliveryResult } as never,
    );

  it('returns false without calling FCM when the user has no registered tokens', async () => {
    const sendToTokensDetailed = jest.fn();
    const service = makeService({ getUserTokens: jest.fn().mockResolvedValue([]), sendToTokensDetailed });

    await expect(service.sendPushToUser('user-1', 'CUSTOMER', 'Title', 'Body')).resolves.toBe(false);
    expect(sendToTokensDetailed).not.toHaveBeenCalled();
  });

  it('sends via FCM to every registered token and reports success', async () => {
    const service = makeService();

    await expect(service.sendPushToUser('user-1', 'CUSTOMER', 'Title', 'Body')).resolves.toBe(true);
  });

  it('feeds a permanently-failed FCM token into hygiene cleanup', async () => {
    const recordDeliveryResult = jest.fn();
    const sendToTokensDetailed = jest.fn().mockResolvedValue([
      {
        provider: 'fcm',
        token: 'fcm-dead-token',
        accepted: false,
        permanentFailure: true,
        errorCode: 'messaging/registration-token-not-registered',
      },
    ]);
    const service = makeService({ sendToTokensDetailed, recordDeliveryResult });

    await expect(service.sendPushToUser('user-1', 'CUSTOMER', 'Title', 'Body')).resolves.toBe(false);

    expect(recordDeliveryResult).toHaveBeenCalledWith(
      expect.objectContaining({ token: 'fcm-dead-token', permanentFailure: true }),
    );
  });

  it('persists to the in-app notification center for CUSTOMER but not other roles', async () => {
    const userNotificationsCreate = jest.fn().mockResolvedValue(undefined);
    const service = makeService({ userNotificationsCreate });

    await service.sendPushToUser('user-1', 'CUSTOMER', 'Title', 'Body', { type: 'ORDER_PLACED' });
    expect(userNotificationsCreate).toHaveBeenCalledWith(
      'user-1',
      'Title',
      'Body',
      'ORDER_PLACED',
      { type: 'ORDER_PLACED' },
    );

    userNotificationsCreate.mockClear();
    await service.sendPushToUser('rider-1', 'RIDER', 'Title', 'Body');
    expect(userNotificationsCreate).not.toHaveBeenCalled();
  });
});

// P0 regression: sendPushToUser unconditionally called fcmProvider, but
// every mobile app (customer, rider) registers Expo-managed tokens
// (Notifications.getExpoPushTokenAsync) — FCM rejects an Expo-format
// token as invalid. This meant every customer-facing push through this
// method (order accepted, scheduled-activated, delayed, the offer/promo
// broadcast) silently failed 100% of the time in practice. Only
// enatega-multivendor-admin's web push registers a real FCM token
// (uploadToken, Firebase JS SDK). These tests lock in per-token routing
// by actual format so this can't regress.
describe('NotificationsService.sendPushToUser — token-format routing', () => {
  const makeService = ({
    getUserTokens,
    sendBatch = jest.fn().mockResolvedValue([]),
    sendToTokensDetailed = jest.fn().mockResolvedValue([]),
  }: {
    getUserTokens: jest.Mock;
    sendBatch?: jest.Mock;
    sendToTokensDetailed?: jest.Mock;
  }) =>
    new NotificationsService(
      {} as never,
      {} as never,
      { getUserTokens } as never,
      { sendToTokensDetailed } as never,
      { sendBatch } as never,
      { create: jest.fn().mockResolvedValue(undefined) } as never,
      { recordDeliveryResult: jest.fn() } as never,
    );

  it('routes an Expo-format token to the Expo provider, not FCM', async () => {
    const sendBatch = jest.fn().mockResolvedValue([
      { provider: 'expo', token: 'ExponentPushToken[abc123]', accepted: true, permanentFailure: false },
    ]);
    const sendToTokensDetailed = jest.fn();
    const service = makeService({
      getUserTokens: jest.fn().mockResolvedValue([{ token: 'ExponentPushToken[abc123]' }]),
      sendBatch,
      sendToTokensDetailed,
    });

    await expect(service.sendPushToUser('customer-1', 'CUSTOMER', 'Title', 'Body')).resolves.toBe(true);

    expect(sendBatch).toHaveBeenCalledWith([
      expect.objectContaining({ to: 'ExponentPushToken[abc123]', title: 'Title', body: 'Body' }),
    ]);
    expect(sendToTokensDetailed).not.toHaveBeenCalled();
  });

  it('routes a real FCM token to the FCM provider, not Expo', async () => {
    const sendBatch = jest.fn();
    const sendToTokensDetailed = jest.fn().mockResolvedValue([
      { provider: 'fcm', token: 'fWzYx:APA91b...', accepted: true, permanentFailure: false },
    ]);
    const service = makeService({
      getUserTokens: jest.fn().mockResolvedValue([{ token: 'fWzYx:APA91b...' }]),
      sendBatch,
      sendToTokensDetailed,
    });

    await expect(service.sendPushToUser('admin-1', 'ADMIN', 'Title', 'Body')).resolves.toBe(true);

    expect(sendToTokensDetailed).toHaveBeenCalledWith(['fWzYx:APA91b...'], { title: 'Title', body: 'Body', data: undefined });
    expect(sendBatch).not.toHaveBeenCalled();
  });

  it('splits a mix of Expo and FCM tokens across both providers for one user', async () => {
    const sendBatch = jest.fn().mockResolvedValue([
      { provider: 'expo', token: 'ExpoPushToken[xyz]', accepted: true, permanentFailure: false },
    ]);
    const sendToTokensDetailed = jest.fn().mockResolvedValue([
      { provider: 'fcm', token: 'raw-fcm-token', accepted: true, permanentFailure: false },
    ]);
    const service = makeService({
      getUserTokens: jest.fn().mockResolvedValue([
        { token: 'ExpoPushToken[xyz]' },
        { token: 'raw-fcm-token' },
      ]),
      sendBatch,
      sendToTokensDetailed,
    });

    await expect(service.sendPushToUser('user-1', 'CUSTOMER', 'Title', 'Body')).resolves.toBe(true);

    expect(sendBatch).toHaveBeenCalledWith([expect.objectContaining({ to: 'ExpoPushToken[xyz]' })]);
    expect(sendToTokensDetailed).toHaveBeenCalledWith(['raw-fcm-token'], expect.any(Object));
  });
});

describe('NotificationsService.broadcastPush', () => {
  it('does one bulk token lookup instead of one per recipient', async () => {
    const getTokensForUsers = jest.fn().mockResolvedValue([
      { token: 'ExponentPushToken[r1]' },
      { token: 'ExponentPushToken[r2]' },
    ]);
    const sendBatch = jest.fn().mockResolvedValue([
      { provider: 'expo', token: 'ExponentPushToken[r1]', accepted: true, permanentFailure: false },
      { provider: 'expo', token: 'ExponentPushToken[r2]', accepted: true, permanentFailure: false },
    ]);
    const userNotificationsCreate = jest.fn().mockResolvedValue(undefined);
    const service = new NotificationsService(
      {} as never,
      {} as never,
      { getTokensForUsers } as never,
      { sendToTokensDetailed: jest.fn().mockResolvedValue([]) } as never,
      { sendBatch } as never,
      { create: userNotificationsCreate } as never,
      { recordDeliveryResult: jest.fn() } as never,
    );

    await service.broadcastPush(
      [
        { userId: 'cust-1', userType: 'CUSTOMER' },
        { userId: 'cust-2', userType: 'CUSTOMER' },
      ],
      'Title',
      'Body',
    );

    expect(getTokensForUsers).toHaveBeenCalledTimes(1);
    expect(getTokensForUsers).toHaveBeenCalledWith([
      { userId: 'cust-1', userType: 'CUSTOMER' },
      { userId: 'cust-2', userType: 'CUSTOMER' },
    ]);
    expect(sendBatch).toHaveBeenCalledTimes(1);
    expect(userNotificationsCreate).toHaveBeenCalledTimes(2);
  });

  it('is a no-op with no recipients and does not query tokens', async () => {
    const getTokensForUsers = jest.fn();
    const service = new NotificationsService(
      {} as never,
      {} as never,
      { getTokensForUsers } as never,
      {} as never,
      {} as never,
      { create: jest.fn() } as never,
      { recordDeliveryResult: jest.fn() } as never,
    );

    await service.broadcastPush([], 'Title', 'Body');
    expect(getTokensForUsers).not.toHaveBeenCalled();
  });
});
