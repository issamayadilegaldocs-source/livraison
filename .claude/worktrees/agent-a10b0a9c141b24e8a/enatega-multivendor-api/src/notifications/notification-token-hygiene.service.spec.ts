import { NotificationTokenHygieneService } from './notification-token-hygiene.service';

describe('NotificationTokenHygieneService', () => {
  const makeService = () => {
    const pushTokenService = {
      quarantinePermanentFailure: jest.fn().mockResolvedValue(1),
      deactivateToken: jest.fn().mockResolvedValue(true),
    };
    const ridersService = { clearNotificationToken: jest.fn().mockResolvedValue(2) };
    const restaurantsService = { clearNotificationToken: jest.fn().mockResolvedValue(3) };
    const usersService = { clearNotificationToken: jest.fn().mockResolvedValue(4) };
    const service = new NotificationTokenHygieneService(
      pushTokenService as never,
      ridersService as never,
      restaurantsService as never,
      usersService as never,
    );
    return { service, pushTokenService, ridersService, restaurantsService, usersService };
  };

  it('quarantines permanent provider token failures across owned token stores', async () => {
    const { service, pushTokenService, ridersService, restaurantsService, usersService } = makeService();

    await service.recordDeliveryResult({
      provider: 'expo',
      token: 'expo-token',
      accepted: false,
      permanentFailure: true,
      errorCode: 'DeviceNotRegistered',
    });

    expect(pushTokenService.quarantinePermanentFailure).toHaveBeenCalledWith({
      token: 'expo-token',
      provider: 'expo',
      errorCode: 'DeviceNotRegistered',
    });
    expect(ridersService.clearNotificationToken).toHaveBeenCalledWith('expo-token');
    expect(restaurantsService.clearNotificationToken).toHaveBeenCalledWith('expo-token');
    expect(usersService.clearNotificationToken).toHaveBeenCalledWith('expo-token');
  });

  it('ignores accepted and transient failures', async () => {
    const { service, pushTokenService, ridersService } = makeService();

    await service.recordDeliveryResult({
      provider: 'expo',
      token: 'expo-token',
      accepted: false,
      permanentFailure: false,
      errorCode: 'MessageTooBig',
    });
    await service.recordDeliveryResult({
      provider: 'expo',
      token: 'expo-token',
      accepted: true,
      permanentFailure: false,
    });

    expect(pushTokenService.quarantinePermanentFailure).not.toHaveBeenCalled();
    expect(ridersService.clearNotificationToken).not.toHaveBeenCalled();
  });
});

// Regression: a physical push token belongs to one device, not one
// account. None of the three mobile apps call unregisterPushToken on
// logout, so if a different user logs into the same device, the previous
// account's token registration would otherwise stay active — meaning the
// previous user's order-status pushes keep landing on the new user's
// device until this method is called before every fresh registration.
describe('NotificationTokenHygieneService.clearTokenEverywhere', () => {
  const makeService = () => {
    const pushTokenService = {
      quarantinePermanentFailure: jest.fn().mockResolvedValue(1),
      deactivateToken: jest.fn().mockResolvedValue(true),
      deactivateOthers: jest.fn().mockResolvedValue(1),
    };
    const ridersService = { clearNotificationToken: jest.fn().mockResolvedValue(1) };
    const restaurantsService = { clearNotificationToken: jest.fn().mockResolvedValue(1) };
    const usersService = { clearNotificationToken: jest.fn().mockResolvedValue(1) };
    const service = new NotificationTokenHygieneService(
      pushTokenService as never,
      ridersService as never,
      restaurantsService as never,
      usersService as never,
    );
    return { service, pushTokenService, ridersService, restaurantsService, usersService };
  };

  it('clears the token from every store before it is reassigned to a new owner (no owner given)', async () => {
    const { service, pushTokenService, ridersService, restaurantsService, usersService } =
      makeService();

    await service.clearTokenEverywhere('shared-device-token');

    expect(pushTokenService.deactivateToken).toHaveBeenCalledWith('shared-device-token');
    expect(pushTokenService.deactivateOthers).not.toHaveBeenCalled();
    expect(ridersService.clearNotificationToken).toHaveBeenCalledWith('shared-device-token');
    expect(restaurantsService.clearNotificationToken).toHaveBeenCalledWith('shared-device-token');
    expect(usersService.clearNotificationToken).toHaveBeenCalledWith('shared-device-token');
  });

  // Regression: when the new owner is known (every real registration call
  // site), the PushToken deactivation must exclude that owner's own row —
  // otherwise a same-user re-login briefly deactivates the exact document
  // it's about to reactivate a moment later, opening a narrow window where
  // a concurrent send could skip a device that was never reassigned.
  it('excludes the new owner from the PushToken deactivation when given', async () => {
    const { service, pushTokenService } = makeService();

    await service.clearTokenEverywhere('shared-device-token', 'new-owner-id');

    expect(pushTokenService.deactivateOthers).toHaveBeenCalledWith('shared-device-token', 'new-owner-id');
    expect(pushTokenService.deactivateToken).not.toHaveBeenCalled();
  });

  it('is a no-op for an empty token', async () => {
    const { service, pushTokenService } = makeService();

    await service.clearTokenEverywhere('');

    expect(pushTokenService.deactivateToken).not.toHaveBeenCalled();
  });

  it('does not throw when one of the underlying clears rejects', async () => {
    const { service, ridersService } = makeService();
    ridersService.clearNotificationToken.mockRejectedValue(new Error('db down'));

    await expect(service.clearTokenEverywhere('token-x')).resolves.toBeUndefined();
  });
});
