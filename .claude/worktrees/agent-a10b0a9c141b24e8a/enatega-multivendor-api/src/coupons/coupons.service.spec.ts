import { Types } from 'mongoose';
import { CouponsService } from './coupons.service';

// A couponModel double whose findOne({title}) resolves to `coupon`.
const modelReturning = (coupon: any) => ({
  findOne: jest.fn().mockReturnValue({
    lean: () => ({ exec: () => Promise.resolve(coupon) }),
  }),
});

const restaurantId = new Types.ObjectId();

describe('CouponsService.applyCoupon — validation rules (CPN)', () => {
  it('CPN-15: unknown code is rejected without applying a discount', async () => {
    const service = new CouponsService(modelReturning(null) as never);
    const res = await service.applyCoupon('NOPE', String(restaurantId));
    expect(res.success).toBe(false);
    expect(res.coupon).toBeUndefined();
  });

  it('CPN-04: a disabled coupon is rejected', async () => {
    const service = new CouponsService(
      modelReturning({ title: 'SAVE', discount: 5, enabled: false }) as never,
    );
    const res = await service.applyCoupon('SAVE', String(restaurantId));
    expect(res.success).toBe(false);
    expect(res.message).toMatch(/disabled/i);
  });

  it('CPN-02: an expired coupon is rejected', async () => {
    const service = new CouponsService(
      modelReturning({
        title: 'SAVE',
        discount: 5,
        enabled: true,
        lifeTimeActive: false,
        startDate: new Date('2020-01-01'),
        endDate: new Date('2020-02-01'),
      }) as never,
    );
    const res = await service.applyCoupon('SAVE', String(restaurantId));
    expect(res.success).toBe(false);
    expect(res.message).toMatch(/expired/i);
  });

  it('CPN-03: a not-yet-active coupon is rejected', async () => {
    const service = new CouponsService(
      modelReturning({
        title: 'SAVE',
        discount: 5,
        enabled: true,
        lifeTimeActive: false,
        startDate: new Date(Date.now() + 86_400_000), // starts tomorrow
        endDate: new Date(Date.now() + 172_800_000),
      }) as never,
    );
    const res = await service.applyCoupon('SAVE', String(restaurantId));
    expect(res.success).toBe(false);
    expect(res.message).toMatch(/not yet active/i);
  });

  it('lifeTimeActive bypasses the date window (an expired window still applies)', async () => {
    const service = new CouponsService(
      modelReturning({
        title: 'SAVE',
        discount: 5,
        enabled: true,
        lifeTimeActive: true,
        startDate: new Date('2020-01-01'),
        endDate: new Date('2020-02-01'),
      }) as never,
    );
    const res = await service.applyCoupon('SAVE', String(restaurantId));
    expect(res.success).toBe(true);
  });

  it('CPN-05: a coupon scoped to another restaurant is rejected', async () => {
    const otherRestaurant = new Types.ObjectId();
    const service = new CouponsService(
      modelReturning({
        title: 'SAVE',
        discount: 5,
        enabled: true,
        lifeTimeActive: true,
        restaurant: otherRestaurant,
      }) as never,
    );
    const res = await service.applyCoupon('SAVE', String(restaurantId));
    expect(res.success).toBe(false);
    expect(res.message).toMatch(/not valid for this restaurant/i);
  });

  it('a coupon scoped to the ordering restaurant is accepted', async () => {
    const service = new CouponsService(
      modelReturning({
        title: 'SAVE',
        discount: 5,
        enabled: true,
        lifeTimeActive: true,
        restaurant: restaurantId,
      }) as never,
    );
    const res = await service.applyCoupon('SAVE', String(restaurantId));
    expect(res.success).toBe(true);
    expect((res.coupon as any).discount).toBe(5);
  });
});

describe('CouponsService.claimUse / releaseUse — atomic usage limits (CPN-06/CNC-03/CPN-16)', () => {
  const couponId = new Types.ObjectId();

  it('unlimited coupons (usageLimit 0) always claim without touching the counter', async () => {
    const findOneAndUpdate = jest.fn();
    const service = new CouponsService({ findOneAndUpdate } as never);
    await expect(service.claimUse(couponId, 0)).resolves.toBe(true);
    expect(findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('claims a use when the atomic guard matches (timesUsed < usageLimit)', async () => {
    const findOneAndUpdate = jest.fn().mockReturnValue({
      lean: () => ({ exec: () => Promise.resolve({ _id: couponId, timesUsed: 1 }) }),
    });
    const service = new CouponsService({ findOneAndUpdate } as never);
    await expect(service.claimUse(couponId, 1)).resolves.toBe(true);
    // The guard must be inside the update filter — that is what makes concurrent
    // single-use redemptions safe.
    const filter = findOneAndUpdate.mock.calls[0][0];
    expect(filter.$expr).toEqual({ $lt: [{ $ifNull: ['$timesUsed', 0] }, 1] });
    expect(findOneAndUpdate.mock.calls[0][1]).toEqual({ $inc: { timesUsed: 1 } });
  });

  it('fails to claim when the limit is already reached (guard returns null)', async () => {
    const findOneAndUpdate = jest.fn().mockReturnValue({
      lean: () => ({ exec: () => Promise.resolve(null) }),
    });
    const service = new CouponsService({ findOneAndUpdate } as never);
    await expect(service.claimUse(couponId, 1)).resolves.toBe(false);
  });

  it('releaseUse decrements only while the counter is above zero (never negative)', async () => {
    const updateOne = jest.fn().mockReturnValue({ exec: () => Promise.resolve({}) });
    const service = new CouponsService({ updateOne } as never);
    await service.releaseUse(couponId);
    expect(updateOne).toHaveBeenCalledWith(
      { _id: couponId, timesUsed: { $gt: 0 } },
      { $inc: { timesUsed: -1 } },
    );
  });
});
