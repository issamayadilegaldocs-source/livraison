import { BadRequestException } from '@nestjs/common';
import { LoyaltyService } from './loyalty.service';

describe('LoyaltyService money calculations', () => {
  const makeService = () => new LoyaltyService({} as never);

  it('values redeemed points at the configured currency scale', () => {
    const service = makeService();

    expect(service.pointsValue(1, 8, { currency: 'TND', scale: 3 })).toBe(0.125);
  });
});

describe('LoyaltyService.redeemPoints', () => {
  const makeModel = (overrides: { findOneAndUpdate?: jest.Mock; findOne?: jest.Mock } = {}) => ({
    findOne: overrides.findOne ?? jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue({ userId: 'u1', points: 100 }) }),
    findOneAndUpdate: overrides.findOneAndUpdate ?? jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue({ userId: 'u1', points: 50 }) }),
    create: jest.fn(),
  });

  it('deducts points and returns the discount when the balance is sufficient', async () => {
    const model = makeModel();
    const service = new LoyaltyService(model as never);

    const discount = await service.redeemPoints('u1', 50, 100, { currency: 'TND', scale: 3 });

    expect(discount).toBe(0.5);
    expect(model.findOneAndUpdate).toHaveBeenCalledWith(
      { userId: 'u1', points: { $gte: 50 } },
      { $inc: { points: -50 } },
    );
  });

  // Regression: the old implementation read `account.points`, checked it,
  // then issued an unconditional $inc — two concurrent redemptions could
  // both pass the read-check before either write landed, driving the
  // balance negative. The atomic filter below is what actually prevents
  // that; this test asserts the failure path when the guarded update
  // matches nothing (i.e. the balance was insufficient at write time).
  it('throws and does not deduct when the atomic guard finds insufficient points', async () => {
    const findOneAndUpdate = jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(null) });
    const findOne = jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue({ userId: 'u1', points: 10 }) });
    const model = makeModel({ findOneAndUpdate, findOne });
    const service = new LoyaltyService(model as never);

    await expect(service.redeemPoints('u1', 50, 100)).rejects.toThrow(BadRequestException);
    expect(findOneAndUpdate).toHaveBeenCalledWith(
      { userId: 'u1', points: { $gte: 50 } },
      { $inc: { points: -50 } },
    );
  });

  it('returns 0 without touching the model for a zero/negative redemption', async () => {
    const model = makeModel();
    const service = new LoyaltyService(model as never);

    await expect(service.redeemPoints('u1', 0, 100)).resolves.toBe(0);
    expect(model.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('rejects when the redemption rate is not configured', async () => {
    const model = makeModel();
    const service = new LoyaltyService(model as never);

    await expect(service.redeemPoints('u1', 10, 0)).rejects.toThrow(BadRequestException);
  });
});
