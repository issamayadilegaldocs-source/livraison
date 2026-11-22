import { Types } from 'mongoose';
import { OrderEarningsService } from './order-earnings.service';

const query = (resolved: unknown) => {
  const q: any = {};
  for (const method of ['sort', 'skip', 'limit', 'populate', 'lean']) {
    q[method] = jest.fn().mockReturnValue(q);
  }
  q.exec = jest.fn().mockResolvedValue(resolved);
  return q;
};

describe('OrderEarningsService', () => {
  it('finds rider earnings with the delivered/date filter and maps plain DTO rows', async () => {
    const riderId = '65a4d4b5e95f1a07a5a3d111';
    const findQuery = query([
      {
        _id: 'order_id',
        orderId: 'ORD-001',
        createdAt: new Date('2026-06-29T10:00:00.000Z'),
        deliveryCharges: 4,
        riderCommission: 2.5,
        isPickedUp: false,
        paymentMethod: 'COD',
      },
    ]);
    const orderModel = { find: jest.fn().mockReturnValue(findQuery) };
    const service = new OrderEarningsService(orderModel as never);

    const result = await service.findRiderEarningsByDate({
      riderId,
      page: 2,
      limit: 5,
      startDate: '2026-06-01',
      endDate: '2026-06-30',
    });

    expect(orderModel.find).toHaveBeenCalledWith({
      rider: new Types.ObjectId(riderId),
      orderStatus: 'DELIVERED',
      createdAt: {
        $gte: new Date('2026-06-01'),
        $lte: new Date('2026-06-30'),
      },
    });
    expect(findQuery.skip).toHaveBeenCalledWith(5);
    expect(findQuery.limit).toHaveBeenCalledWith(5);
    expect(result).toEqual({
      totalCount: 1,
      days: [
        {
          date: '2026-06-29',
          orders: [
            expect.objectContaining({
              id: 'order_id',
              orderId: 'ORD-001',
              deliveryCharges: 4,
              riderEarnings: 2.5,
              isPickedUp: false,
              paymentMethod: 'COD',
            }),
          ],
        },
      ],
    });
  });

  it('sums rider earnings (commission + tip + bonus), matching the graph per-day total', async () => {
    const orderModel = {
      find: jest.fn().mockReturnValue(
        query([
          // riderEarnings bundles the bonus; commission-only = 3, +0 tip +0 bonus = 3
          { riderEarnings: 3, riderCommission: 10 },
          // no riderEarnings → falls back to riderCommission = 4
          { riderCommission: 4 },
          {},
          // riderEarnings 5 = commission 3.5 + bonus 1.5; +tip 2 +bonus 1.5 = 7
          { riderEarnings: 5, tipping: 2, deliveryBonus: 1.5 },
        ]),
      ),
    };
    const service = new OrderEarningsService(orderModel as never);

    // 3 + 4 + 0 + 7 = 14
    await expect(service.sumRiderEarnings({ orderType: 'PICK_UP' })).resolves.toBe(14);
    expect(orderModel.find).toHaveBeenCalledWith({
      orderStatus: 'DELIVERED',
      isPickedUp: true,
    });
  });

  it('keeps store date aggregation owned by Orders', async () => {
    const restaurantId = '65a4d4b5e95f1a07a5a3d222';
    const groupsQuery = query([
      {
        _id: '2026-06-29',
        totalOrderAmount: 100,
        totalStoreBase: 100,
        totalDeliveries: 2,
        earningsArray: [
          {
            totalOrderAmount: 60,
            storeBase: 60,
            orderDetails: { orderId: 'ORD-001', orderType: 'DELIVERY', paymentMethod: 'COD' },
          },
        ],
      },
    ]);
    const countQuery = query([{ totalCount: 1 }]);
    const orderModel = {
      aggregate: jest.fn().mockReturnValueOnce(groupsQuery).mockReturnValueOnce(countQuery),
    };
    const service = new OrderEarningsService(orderModel as never);

    const result = await service.findStoreEarningsByDate({
      restaurantId,
      page: 3,
      limit: 10,
    });

    expect(orderModel.aggregate.mock.calls[0][0][0]).toEqual({
      $match: {
        restaurant: new Types.ObjectId(restaurantId),
        orderStatus: 'DELIVERED',
      },
    });
    expect(orderModel.aggregate.mock.calls[0][0]).toEqual(
      expect.arrayContaining([{ $skip: 20 }, { $limit: 10 }]),
    );
    expect(result).toEqual({
      totalCount: 1,
      days: [
        {
          date: '2026-06-29',
          totalOrderAmount: 100,
          totalStoreBase: 100,
          totalDeliveries: 2,
          entries: [
            {
              totalOrderAmount: 60,
              storeBase: 60,
              orderDetails: { orderId: 'ORD-001', orderType: 'DELIVERY', paymentMethod: 'COD' },
            },
          ],
        },
      ],
    });
  });

  it('returns admin page/all rows with populated refs mapped to plain DTOs', async () => {
    const pageQuery = query([
      {
        _id: 'order_page',
        orderId: 'ORD-002',
        createdAt: new Date('2026-06-29T11:00:00.000Z'),
        updatedAt: new Date('2026-06-29T12:00:00.000Z'),
        orderAmount: 50,
        deliveryCharges: 5,
        taxationAmount: 1,
        riderEarnings: 3,
        isPickedUp: true,
        rider: { _id: 'rider_id', name: 'Rider', username: 'rider' },
        restaurant: { _id: 'store_id', name: 'Store', username: 'store', commissionRate: 0.2 },
      },
    ]);
    const allQuery = query([{ _id: 'order_all', orderAmount: 80, restaurant: { commissionRate: 0.15 } }]);
    const countQuery = { exec: jest.fn().mockResolvedValue(7) };
    const orderModel = {
      find: jest.fn().mockReturnValueOnce(pageQuery).mockReturnValueOnce(allQuery),
      countDocuments: jest.fn().mockReturnValue(countQuery),
    };
    const service = new OrderEarningsService(orderModel as never);

    const result = await service.findAdminEarnings({
      search: 'ORD',
      paymentMethod: 'COD',
      page: 1,
      limit: 10,
    });

    expect(orderModel.find.mock.calls[0][0]).toEqual({
      orderStatus: 'DELIVERED',
      paymentMethod: 'COD',
      orderId: { $regex: 'ORD', $options: 'i' },
    });
    expect(pageQuery.populate).toHaveBeenCalledWith('rider', '_id name username');
    expect(pageQuery.populate).toHaveBeenCalledWith('restaurant', '_id name username commissionRate');
    expect(result.totalCount).toBe(7);
    expect(result.page[0]).toEqual(
      expect.objectContaining({
        id: 'order_page',
        riderEarnings: 3,
        rider: { id: 'rider_id', name: 'Rider', username: 'rider', commissionRate: undefined },
        restaurant: { id: 'store_id', name: 'Store', username: 'store', commissionRate: 0.2 },
      }),
    );
  });
});
