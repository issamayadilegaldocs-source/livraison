import { BadRequestException } from '@nestjs/common';
import { WalletService } from './wallet.service';
import { OrderTypeEnum, UserTypeEnum } from './models/earnings.model';

const query = (resolved: unknown) => {
  const q: any = {};
  for (const m of ['sort', 'skip', 'limit', 'populate', 'lean']) {
    q[m] = jest.fn().mockReturnValue(q);
  }
  q.exec = jest.fn().mockResolvedValue(resolved);
  return q;
};

describe('WalletService withdraw decoupling', () => {
  const makeService = ({
    orderEarnings = {},
    withdrawModel = {},
    ridersService = {},
    restaurantsService = {},
    configurationService = {},
  }: any) =>
    new WalletService(
      orderEarnings,
      withdrawModel,
      ridersService,
      restaurantsService,
      configurationService,
    );

  it('approves a pending rider withdraw request and debits exactly once', async () => {
    const withdrawModel = {
      findOneAndUpdate: jest.fn().mockReturnValue(query({ _id: 'wd_1', rider: 'rider_id' })),
      findById: jest.fn().mockReturnValue(query({ _id: 'wd_1', rider: { _id: 'rider_id' } })),
    };
    const ridersService = {
      debitWalletForWithdrawal: jest.fn().mockResolvedValue(undefined),
    };
    const configurationService = {
      get: jest.fn().mockResolvedValue({ currency: 'TND', currencyDecimalDigits: 3 }),
    };
    const service = makeService({ withdrawModel, ridersService, configurationService });

    await service.approveWithdrawRequest('wd_1', 50);

    expect(withdrawModel.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: 'wd_1', status: 'PENDING' },
      {
        status: 'APPROVED',
        approvedAmount: 50,
        approvedAmountMinor: 50000,
        requestAmountCurrency: 'TND',
        requestAmountScale: 3,
      },
      { new: true },
    );
    expect(ridersService.debitWalletForWithdrawal).toHaveBeenCalledTimes(1);
    expect(ridersService.debitWalletForWithdrawal).toHaveBeenCalledWith(
      'rider_id',
      50,
      50000,
      expect.objectContaining({ currency: 'TND', scale: 3 }),
    );
  });

  it('approves a pending store withdraw request through the Restaurants-owned wallet command', async () => {
    const withdrawModel = {
      findOneAndUpdate: jest.fn().mockReturnValue(query({ _id: 'wd_1', restaurant: 'store_id' })),
      findById: jest.fn().mockReturnValue(query({ _id: 'wd_1', restaurant: { _id: 'store_id' } })),
    };
    const restaurantsService = {
      debitWalletForWithdrawal: jest.fn().mockResolvedValue(undefined),
    };
    const configurationService = {
      get: jest.fn().mockResolvedValue({ currency: 'TND', currencyDecimalDigits: 3 }),
    };
    const service = makeService({ withdrawModel, restaurantsService, configurationService });

    await service.approveWithdrawRequest('wd_1', 10.005);

    expect(restaurantsService.debitWalletForWithdrawal).toHaveBeenCalledWith(
      'store_id',
      10.005,
      10005,
      expect.objectContaining({ currency: 'TND', scale: 3 }),
    );
  });

  it('rejects approve when request is not pending without debiting', async () => {
    const withdrawModel = {
      findOneAndUpdate: jest.fn().mockReturnValue(query(null)),
    };
    const ridersService = {
      debitWalletForWithdrawal: jest.fn(),
    };
    const service = makeService({ withdrawModel, ridersService });

    await expect(service.approveWithdrawRequest('wd_1', 50)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(ridersService.debitWalletForWithdrawal).not.toHaveBeenCalled();
  });

  it('debits on first paid status transition', async () => {
    const withdrawModel = {
      findById: jest
        .fn()
        .mockReturnValueOnce(query({ _id: 'wd_1', status: 'PENDING', rider: 'rider_id', requestAmount: 30 }))
        .mockReturnValueOnce(query({ _id: 'wd_1', status: 'APPROVED', rider: { _id: 'rider_id' } })),
      findByIdAndUpdate: jest.fn().mockReturnValue(query({ _id: 'wd_1' })),
    };
    const ridersService = {
      debitWalletForWithdrawal: jest.fn().mockResolvedValue(undefined),
      creditWalletForWithdrawal: jest.fn(),
    };
    const configurationService = {
      get: jest.fn().mockResolvedValue({ currency: 'TND', currencyDecimalDigits: 3 }),
    };
    const service = makeService({ withdrawModel, ridersService, configurationService });

    await service.updateWithdrawReqStatus('wd_1', 'APPROVED');

    expect(ridersService.debitWalletForWithdrawal).toHaveBeenCalledWith(
      'rider_id',
      30,
      30000,
      expect.objectContaining({ currency: 'TND', scale: 3 }),
    );
    expect(ridersService.creditWalletForWithdrawal).not.toHaveBeenCalled();
  });

  it('refunds on cancel after a paid status', async () => {
    const withdrawModel = {
      findById: jest
        .fn()
        .mockReturnValueOnce(query({ _id: 'wd_1', status: 'APPROVED', rider: 'rider_id', requestAmount: 30 }))
        .mockReturnValueOnce(query({ _id: 'wd_1', status: 'CANCELLED', rider: { _id: 'rider_id' } })),
      findByIdAndUpdate: jest.fn().mockReturnValue(query({ _id: 'wd_1' })),
    };
    const ridersService = {
      debitWalletForWithdrawal: jest.fn(),
      creditWalletForWithdrawal: jest.fn().mockResolvedValue(undefined),
    };
    const configurationService = {
      get: jest.fn().mockResolvedValue({ currency: 'TND', currencyDecimalDigits: 3 }),
    };
    const service = makeService({ withdrawModel, ridersService, configurationService });

    await service.updateWithdrawReqStatus('wd_1', 'CANCELLED');

    expect(ridersService.creditWalletForWithdrawal).toHaveBeenCalledWith(
      'rider_id',
      30,
      30000,
      expect.objectContaining({ currency: 'TND', scale: 3 }),
    );
    expect(ridersService.debitWalletForWithdrawal).not.toHaveBeenCalled();
  });

  it('rejects rider withdraw request when wallet context has insufficient balance', async () => {
    const withdrawModel = {
      findOne: jest.fn().mockReturnValue(query(null)),
      create: jest.fn(),
    };
    const ridersService = {
      getWalletContext: jest.fn().mockResolvedValue({ id: 'rider_id', currentWalletAmount: 20 }),
    };
    const service = makeService({ withdrawModel, ridersService });

    await expect(service.createWithdrawRequest('rider_1', 25)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(withdrawModel.create).not.toHaveBeenCalled();
  });

  it('creates rider withdraw requests with configured minor-unit metadata', async () => {
    const withdrawModel = {
      findOne: jest.fn().mockReturnValue(query(null)),
      create: jest.fn().mockResolvedValue({}),
    };
    const ridersService = {
      getWalletContext: jest.fn().mockResolvedValue({
        id: 'rider_id',
        currentWalletAmount: 20.005,
        currentWalletAmountMinor: 20005,
      }),
    };
    const configurationService = {
      get: jest.fn().mockResolvedValue({ currency: 'TND', currencyDecimalDigits: 3 }),
    };
    const service = makeService({ withdrawModel, ridersService, configurationService });

    await service.createWithdrawRequest('rider_1', 10.005);

    expect(withdrawModel.create).toHaveBeenCalledWith({
      rider: 'rider_id',
      requestAmount: 10.005,
      requestAmountMinor: 10005,
      requestAmountCurrency: 'TND',
      requestAmountScale: 3,
      status: 'PENDING',
    });
  });

  it('rejects store withdraw request when wallet context has insufficient balance', async () => {
    const withdrawModel = {
      findOne: jest.fn().mockReturnValue(query(null)),
      create: jest.fn(),
    };
    const restaurantsService = {
      getWalletContext: jest.fn().mockResolvedValue({ id: 'store_id', currentWalletAmount: 20 }),
    };
    const service = makeService({ withdrawModel, restaurantsService });

    await expect(service.createWithdrawRequestStore('store_1', 25)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(withdrawModel.create).not.toHaveBeenCalled();
  });
});

describe('WalletService earnings decoupling', () => {
  const riderMongoId = '65a4d4b5e95f1a07a5a3d111';
  const storeMongoId = '65a4d4b5e95f1a07a5a3d222';

  const makeService = ({
    orderEarnings = {},
    ridersService = {},
    restaurantsService = {},
    withdrawModel = {},
    configurationService = {},
  }: any) =>
    new WalletService(
      orderEarnings,
      withdrawModel,
      ridersService,
      restaurantsService,
      configurationService,
    );

  it('builds rider earnings graph from the Orders-owned earnings port', async () => {
    const orderEarnings = {
      findRiderEarningsByDate: jest.fn().mockResolvedValue({
        totalCount: 1,
        days: [
          {
            date: '2026-06-29',
            orders: [
              {
                orderId: 'ORD-001',
                createdAt: new Date('2026-06-29T10:00:00.000Z'),
                deliveryCharges: 5,
                riderEarnings: 3,
                isPickedUp: false,
                paymentMethod: 'COD',
              },
            ],
          },
        ],
      }),
    };
    const ridersService = {
      resolveMongoIdByClerkId: jest.fn().mockResolvedValue(riderMongoId),
    };
    const service = makeService({ orderEarnings, ridersService });

    const result = await service.riderEarningsGraph(
      'clerk_rider',
      2,
      5,
      '2026-06-01',
      '2026-06-30',
    );

    expect(orderEarnings.findRiderEarningsByDate).toHaveBeenCalledWith({
      riderId: riderMongoId,
      page: 2,
      limit: 5,
      startDate: '2026-06-01',
      endDate: '2026-06-30',
    });
    expect(result.earnings?.[0]).toEqual(
      expect.objectContaining({
        _id: '2026-06-29',
        totalDeliveries: 1,
        totalEarningsSum: 3,
      }),
    );
    expect(result.earnings?.[0].earningsArray?.[0]).toEqual(
      expect.objectContaining({
        deliveryFee: 5,
        commission: 3,
        totalEarnings: 3,
        orderDetails: { orderId: 'ORD-001', orderType: 'DELIVERY', paymentMethod: 'COD' },
      }),
    );
  });

  it('applies store commission math in Wallet after Orders returns store buckets', async () => {
    const orderEarnings = {
      findStoreEarningsByDate: jest.fn().mockResolvedValue({
        totalCount: 1,
        days: [
          {
            date: '2026-06-29',
            totalOrderAmount: 100,
            // Store payout is charged on the commission base (original subtotal),
            // reported per-day as totalStoreBase and per-entry as storeBase.
            totalStoreBase: 100,
            totalDeliveries: 2,
            entries: [
              {
                totalOrderAmount: 40,
                storeBase: 40,
                orderDetails: { orderId: 'ORD-002', orderType: 'PICK_UP', paymentMethod: 'CARD' },
              },
            ],
          },
        ],
      }),
    };
    const restaurantsService = {
      getCommissionRate: jest.fn().mockResolvedValue(0.25),
    };
    const service = makeService({ orderEarnings, restaurantsService });

    const result = await service.storeEarningsGraph(storeMongoId, 1, 10);

    expect(orderEarnings.findStoreEarningsByDate).toHaveBeenCalledWith({
      restaurantId: storeMongoId,
      page: 1,
      limit: 10,
      startDate: undefined,
      endDate: undefined,
    });
    expect(result.earnings?.[0]).toEqual(
      expect.objectContaining({
        totalOrderAmount: 100,
        totalEarningsSum: 75,
      }),
    );
    expect(result.earnings?.[0].earningsArray?.[0]).toEqual(
      expect.objectContaining({
        totalOrderAmount: 40,
        totalEarnings: 30,
      }),
    );
  });

  it('preserves admin earnings totals and commission clamp using port DTOs', async () => {
    const orderEarnings = {
      findAdminEarnings: jest.fn().mockResolvedValue({
        totalCount: 1,
        page: [
          {
            id: 'order_id',
            orderId: 'ORD-003',
            createdAt: new Date('2026-06-29T10:00:00.000Z'),
            updatedAt: new Date('2026-06-29T11:00:00.000Z'),
            orderAmount: 100,
            deliveryCharges: 4,
            taxationAmount: 2,
            riderEarnings: 7,
            isPickedUp: false,
            paymentMethod: 'COD',
            rider: { id: 'rider_id', name: 'Rider', username: 'rider' },
            restaurant: { id: 'store_id', name: 'Store', username: 'store', commissionRate: 2 },
          },
        ],
        all: [
          {
            id: 'order_id',
            orderAmount: 100,
            deliveryCharges: 4,
            taxationAmount: 2,
            riderEarnings: 7,
            isPickedUp: false,
            restaurant: { id: 'store_id', commissionRate: 2 },
          },
        ],
      }),
    };
    const service = makeService({ orderEarnings });

    const result = await service.getEarning({
      userType: UserTypeEnum.RIDER,
      userId: riderMongoId,
      orderType: OrderTypeEnum.DELIVERY,
      paymentMethod: 'COD',
      pagination: { pageNo: 1, pageSize: 10 },
      dateFilter: { starting_date: '2026-06-01', ending_date: '2026-06-30' },
      search: 'ORD',
    });

    expect(orderEarnings.findAdminEarnings).toHaveBeenCalledWith({
      riderId: riderMongoId,
      restaurantId: undefined,
      orderType: OrderTypeEnum.DELIVERY,
      paymentMethod: 'COD',
      search: 'ORD',
      startDate: '2026-06-01',
      endDate: '2026-06-30',
      page: 1,
      limit: 10,
    });
    // orderAmount 100 = netFood 94 + delivery 4 + tax 2 (tip/express 0), rate
    // clamped to 1. Rider commission 7 is clamped to the 4 delivery fee actually
    // collected. The three parts must sum back to the 100 of cash collected —
    // the old figures (106 + 0 + 7 = 113) invented 13 of cash that never existed.
    expect(result.data?.grandTotalEarnings).toEqual({
      platformTotal: 96, // commission 94 + delivery remainder 0 + tax 2
      riderTotal: 4, // delivery commission clamped to 4 + tip 0
      storeTotal: 0, // netFood 94 × (1 − 1)
    });
    const totals = result.data!.grandTotalEarnings!;
    expect(totals.platformTotal! + totals.riderTotal! + totals.storeTotal!).toBe(100);
    expect(result.data?.earnings?.[0].platformEarnings?.totalEarnings).toBe(96);
    expect(result.data?.earnings?.[0].storeEarnings?.totalEarnings).toBe(0);
  });
});
