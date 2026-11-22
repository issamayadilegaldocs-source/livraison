import { Types } from 'mongoose';
import { OrderStatsService } from './order-stats.service';

/** Builds a thenable query stub whose chained methods all return itself. */
const query = (resolved: unknown) => {
  const q: any = {};
  for (const m of ['find', 'populate', 'lean']) {
    q[m] = jest.fn().mockReturnValue(q);
  }
  q.exec = jest.fn().mockResolvedValue(resolved);
  return q;
};

const RESTAURANT_A = '65a4d4b5e95f1a07a5a3d111';
const RESTAURANT_B = '65a4d4b5e95f1a07a5a3d222';

describe('OrderStatsService', () => {
  describe('lastOrderTimestamps', () => {
    it('maps aggregation rows to { restaurantId, lastOrderAt } in epoch ms', async () => {
      const idA = new Types.ObjectId(RESTAURANT_A);
      const lastOrder = new Date('2026-06-01T10:00:00.000Z');
      const aggregate = jest
        .fn()
        .mockResolvedValue([{ _id: idA, lastOrder }]);
      const service = new OrderStatsService({ aggregate } as never, {} as never);

      const result = await service.lastOrderTimestamps([RESTAURANT_A, RESTAURANT_B]);

      expect(result).toEqual([
        { restaurantId: RESTAURANT_A, lastOrderAt: lastOrder.getTime() },
      ]);
      // Aggregation must match against the requested restaurant ObjectIds.
      const [pipeline] = aggregate.mock.calls[0];
      expect(pipeline[0].$match.restaurant.$in).toHaveLength(2);
      expect(pipeline[0].$match.restaurant.$in[0]).toBeInstanceOf(Types.ObjectId);
    });

    it('returns [] without querying when no ids are given', async () => {
      const aggregate = jest.fn();
      const service = new OrderStatsService({ aggregate } as never, {} as never);

      await expect(service.lastOrderTimestamps([])).resolves.toEqual([]);
      expect(aggregate).not.toHaveBeenCalled();
    });
  });

  describe('orderCounts', () => {
    it('maps aggregation rows to { restaurantId, count }', async () => {
      const idA = new Types.ObjectId(RESTAURANT_A);
      const idB = new Types.ObjectId(RESTAURANT_B);
      const aggregate = jest
        .fn()
        .mockResolvedValue([
          { _id: idA, count: 5 },
          { _id: idB, count: 2 },
        ]);
      const service = new OrderStatsService({ aggregate } as never, {} as never);

      await expect(
        service.orderCounts([RESTAURANT_A, RESTAURANT_B]),
      ).resolves.toEqual([
        { restaurantId: RESTAURANT_A, count: 5 },
        { restaurantId: RESTAURANT_B, count: 2 },
      ]);
    });
  });

  describe('countOrdersForRestaurant', () => {
    it('counts orders referencing the restaurant ObjectId', async () => {
      const countDocuments = jest
        .fn()
        .mockReturnValue({ exec: jest.fn().mockResolvedValue(3) });
      const service = new OrderStatsService({ countDocuments } as never, {} as never);

      await expect(service.countOrdersForRestaurant(RESTAURANT_A)).resolves.toBe(3);
      const [filter] = countDocuments.mock.calls[0];
      expect(filter.restaurant).toBeInstanceOf(Types.ObjectId);
      expect(String(filter.restaurant)).toBe(RESTAURANT_A);
    });
  });

  describe('reviewsByRestaurant', () => {
    it('computes average/total and maps reviews to plain DTOs (ObjectId → string)', async () => {
      const reviewId = new Types.ObjectId();
      const orderId = new Types.ObjectId();
      const userId = new Types.ObjectId();
      const restaurantId = new Types.ObjectId(RESTAURANT_A);
      const createdAt = new Date('2026-06-02T08:00:00.000Z');
      const reviewModel = query([
        {
          _id: reviewId,
          rating: 4,
          comments: 'legacy',
          description: 'great',
          createdAt,
          order: { _id: orderId, user: { _id: userId, name: 'Sam', email: 's@x.com' } },
          restaurant: { _id: restaurantId, name: 'Resto' },
        },
        { _id: new Types.ObjectId(), rating: 2 },
      ]);
      const service = new OrderStatsService({} as never, reviewModel as never);

      const result = await service.reviewsByRestaurant(RESTAURANT_A);

      expect(result.total).toBe(2);
      expect(result.ratings).toBe(3); // (4 + 2) / 2
      const [first] = result.reviews;
      expect(first._id).toBe(String(reviewId));
      expect(first.order).toEqual({
        _id: String(orderId),
        user: { _id: String(userId), name: 'Sam', email: 's@x.com' },
      });
      expect(first.restaurant).toEqual({ _id: String(restaurantId), name: 'Resto' });
      // Query must filter active reviews for the restaurant and populate
      // order→user and restaurant with the expected projections.
      expect(reviewModel.find).toHaveBeenCalledWith(
        expect.objectContaining({ isActive: true }),
      );
      expect(reviewModel.populate).toHaveBeenCalledWith(
        expect.objectContaining({ path: 'order', select: '_id user' }),
      );
    });

    it('returns ratings: null when there are no reviews', async () => {
      const reviewModel = query([]);
      const service = new OrderStatsService({} as never, reviewModel as never);

      await expect(service.reviewsByRestaurant(RESTAURANT_A)).resolves.toEqual({
        reviews: [],
        ratings: null,
        total: 0,
      });
    });
  });
});
