import { PushTokenService } from './push-token.service';

describe('PushTokenService', () => {
  const makeModel = (overrides: Record<string, jest.Mock> = {}) => ({
    findOne: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockResolvedValue({ _id: 'new-doc' }),
    updateMany: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue({ modifiedCount: 1 }) }),
    find: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue([]) }),
    countDocuments: jest.fn().mockResolvedValue(0),
    ...overrides,
  });

  it('creates a new token document when none exists for this token/user/platform/type', async () => {
    const model = makeModel();
    const service = new PushTokenService(model as never);

    await service.registerToken('tok-1', 'ios', 'user-1', 'CUSTOMER');

    expect(model.findOne).toHaveBeenCalledWith({
      token: 'tok-1',
      userId: 'user-1',
      userType: 'CUSTOMER',
      platform: 'ios',
    });
    expect(model.create).toHaveBeenCalledWith(
      expect.objectContaining({ token: 'tok-1', userId: 'user-1', userType: 'CUSTOMER', active: true }),
    );
  });

  it('reactivates and refreshes an existing token document instead of duplicating it', async () => {
    const existing = { active: false, lastUsedAt: null, save: jest.fn().mockResolvedValue(true) };
    const model = makeModel({ findOne: jest.fn().mockResolvedValue(existing) });
    const service = new PushTokenService(model as never);

    await service.registerToken('tok-1', 'ios', 'user-1', 'CUSTOMER');

    expect(existing.active).toBe(true);
    expect(existing.save).toHaveBeenCalled();
    expect(model.create).not.toHaveBeenCalled();
  });

  // Regression: unregisterPushToken previously deactivated by token alone
  // with no ownership check, letting any authenticated caller deactivate
  // any other user's token. deactivateOwnToken must scope by both.
  it('deactivateOwnToken scopes the update to token AND userId', async () => {
    const model = makeModel();
    const service = new PushTokenService(model as never);

    await service.deactivateOwnToken('tok-1', 'user-1');

    expect(model.updateMany).toHaveBeenCalledWith(
      { token: 'tok-1', userId: 'user-1' },
      expect.objectContaining({ $set: expect.objectContaining({ active: false }) }),
    );
  });

  it('deactivateOthers excludes the given owner from the deactivation', async () => {
    const model = makeModel();
    const service = new PushTokenService(model as never);

    await service.deactivateOthers('tok-1', 'new-owner-id');

    expect(model.updateMany).toHaveBeenCalledWith(
      { token: 'tok-1', userId: { $ne: 'new-owner-id' } },
      expect.objectContaining({ $set: expect.objectContaining({ active: false }) }),
    );
  });

  it('deactivateToken (unscoped) is only used for cross-account reassignment/hygiene, not caller-facing', async () => {
    const model = makeModel();
    const service = new PushTokenService(model as never);

    await service.deactivateToken('tok-1');

    expect(model.updateMany).toHaveBeenCalledWith(
      { token: 'tok-1' },
      expect.objectContaining({ $set: expect.objectContaining({ active: false }) }),
    );
  });

  it('quarantinePermanentFailure only deactivates currently-active tokens and records the reason', async () => {
    const model = makeModel();
    const service = new PushTokenService(model as never);

    await service.quarantinePermanentFailure({
      token: 'tok-1',
      provider: 'expo',
      errorCode: 'DeviceNotRegistered',
    });

    expect(model.updateMany).toHaveBeenCalledWith(
      { token: 'tok-1', active: { $ne: false } },
      expect.objectContaining({
        $set: expect.objectContaining({
          active: false,
          deactivationReason: 'permanent_push_failure:expo:DeviceNotRegistered',
        }),
      }),
    );
  });

  it('getUserTokens only returns active tokens for that user/type', async () => {
    const model = makeModel();
    const service = new PushTokenService(model as never);

    await service.getUserTokens('user-1', 'RIDER');

    expect(model.find).toHaveBeenCalledWith({ userId: 'user-1', userType: 'RIDER', active: true });
  });

  it('getTokensForUsers does one query for every recipient instead of one query each', async () => {
    const model = makeModel();
    const service = new PushTokenService(model as never);

    await service.getTokensForUsers([
      { userId: 'user-1', userType: 'CUSTOMER' },
      { userId: 'user-2', userType: 'CUSTOMER' },
    ]);

    expect(model.find).toHaveBeenCalledTimes(1);
    expect(model.find).toHaveBeenCalledWith({
      active: true,
      $or: [
        { userId: 'user-1', userType: 'CUSTOMER' },
        { userId: 'user-2', userType: 'CUSTOMER' },
      ],
    });
  });

  it('getTokensForUsers is a no-op query for an empty recipient list', async () => {
    const model = makeModel();
    const service = new PushTokenService(model as never);

    await expect(service.getTokensForUsers([])).resolves.toEqual([]);
    expect(model.find).not.toHaveBeenCalled();
  });
});
