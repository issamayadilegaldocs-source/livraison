import { BadRequestException } from '@nestjs/common';
import { CustomerWalletService } from './customer-wallet.service';

describe('CustomerWalletService', () => {
  const userId = 'user_123';

  const execResult = (value: unknown) => ({ exec: jest.fn().mockResolvedValue(value) });

  const makeService = () => {
    const walletModel = {
      findOne: jest.fn(),
      findOneAndUpdate: jest.fn(),
      create: jest.fn(),
    };
    const txnModel = {
      find: jest.fn(),
      create: jest.fn(),
    };

    const service = new CustomerWalletService(walletModel as any, txnModel as any);

    return { service, walletModel, txnModel };
  };

  it('credits using integer minor units and records the ledger balance', async () => {
    const { service, walletModel, txnModel } = makeService();
    walletModel.findOneAndUpdate.mockReturnValue(execResult({ userId, balanceMinor: 300 }));
    txnModel.create.mockResolvedValue({});

    const balance = await service.credit(userId, 0.1, { reason: 'topup' });

    expect(balance).toBe(0.3);
    expect(walletModel.findOneAndUpdate).toHaveBeenCalledWith(
      { userId },
      expect.arrayContaining([
        {
          $set: expect.objectContaining({
            userId,
            balanceMinor: expect.objectContaining({ $add: [expect.any(Object), 100] }),
          }),
        },
        { $set: { balance: { $divide: ['$balanceMinor', 1000] } } },
      ]),
      { new: true, upsert: true },
    );
    expect(walletModel.findOneAndUpdate.mock.calls[0][1]).not.toEqual(
      expect.objectContaining({ $inc: expect.anything() }),
    );
    expect(txnModel.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId,
        type: 'CREDIT',
        amountMinor: 100,
        amount: 0.1,
        balanceAfterMinor: 300,
        balanceAfter: 0.3,
        reason: 'topup',
      }),
    );
  });

  it('debits with an atomic integer-minor-unit sufficient-funds guard', async () => {
    const { service, walletModel, txnModel } = makeService();
    walletModel.findOneAndUpdate.mockReturnValue(execResult({ userId, balanceMinor: 1250 }));
    txnModel.create.mockResolvedValue({});

    const balance = await service.debit(userId, 0.25);

    expect(balance).toBe(1.25);
    expect(walletModel.findOneAndUpdate).toHaveBeenCalledWith(
      {
        userId,
        $expr: { $gte: [expect.any(Object), 250] },
      },
      expect.arrayContaining([
        {
          $set: expect.objectContaining({
            balanceMinor: expect.objectContaining({ $add: [expect.any(Object), -250] }),
          }),
        },
      ]),
      { new: true },
    );
    expect(txnModel.create).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'DEBIT',
        amountMinor: 250,
        balanceAfterMinor: 1250,
      }),
    );
  });

  it('rejects debit when the integer guard finds insufficient funds', async () => {
    const { service, walletModel, txnModel } = makeService();
    walletModel.findOneAndUpdate.mockReturnValue(execResult(null));

    await expect(service.debit(userId, 5)).rejects.toBeInstanceOf(BadRequestException);
    expect(txnModel.create).not.toHaveBeenCalled();
  });

  it('reads minor-unit balances and falls back to legacy float documents', async () => {
    const { service, walletModel } = makeService();
    walletModel.findOne.mockReturnValueOnce({
      lean: jest.fn().mockReturnValue(execResult({ userId, balanceMinor: 1234, balance: 99 })),
    });
    walletModel.findOne.mockReturnValueOnce({
      lean: jest.fn().mockReturnValue(execResult({ userId, balance: 1.005 })),
    });

    await expect(service.getBalance(userId)).resolves.toBe(1.234);
    await expect(service.getBalance(userId)).resolves.toBe(1.005);
  });

  it('returns wallet transactions from exact minor-unit fields when present', async () => {
    const { service, walletModel, txnModel } = makeService();
    walletModel.findOne.mockReturnValue(execResult({ userId, balanceMinor: 1200 }));
    txnModel.find.mockReturnValue({
      sort: jest.fn().mockReturnValue({
        limit: jest.fn().mockReturnValue({
          lean: jest.fn().mockReturnValue(
            execResult([
              {
                _id: 'txn_1',
                type: 'CREDIT',
                amountMinor: 700,
                amount: 999,
                balanceAfterMinor: 1200,
                balanceAfter: 999,
                createdAt: new Date('2026-06-28T00:00:00.000Z'),
              },
            ]),
          ),
        }),
      }),
    });

    await expect(service.getWallet(userId)).resolves.toEqual({
      balance: 1.2,
      currency: undefined,
      balanceMoney: { currency: 'TND', scale: 3, amount: '1.200', minorUnits: '1200' },
      transactions: [
        {
          _id: 'txn_1',
          type: 'CREDIT',
          amount: 0.7,
          balanceAfter: 1.2,
          amountMoney: { currency: 'TND', scale: 3, amount: '0.700', minorUnits: '700' },
          balanceAfterMoney: { currency: 'TND', scale: 3, amount: '1.200', minorUnits: '1200' },
          order: undefined,
          reason: undefined,
          createdAt: '2026-06-28T00:00:00.000Z',
        },
      ],
    });
  });

  it('exposes a Money read surface derived from the persisted minor balance', async () => {
    const { service, walletModel, txnModel } = makeService();
    walletModel.findOne.mockReturnValue(execResult({ userId, balanceMinor: 23450, currency: 'TND' }));
    txnModel.find.mockReturnValue({
      sort: jest.fn().mockReturnValue({
        limit: jest.fn().mockReturnValue({ lean: jest.fn().mockReturnValue(execResult([])) }),
      }),
    });

    const wallet = await service.getWallet(userId);
    expect(wallet.balanceMoney).toEqual({
      currency: 'TND',
      scale: 3,
      amount: '23.450',
      minorUnits: '23450',
    });
  });

  // CNC-04: two concurrent debits that individually fit the balance but whose
  // sum exceeds it must not both succeed (no lost-update / overdraft race).
  // This simulates MongoDB's real atomicity guarantee for `findOneAndUpdate`
  // with an `$expr` guard: the guard is checked and the write applied as a
  // single indivisible step per call, with no interleaving possible between
  // the read and the write — exactly what makes the production query safe.
  it('CNC-04: only one of two concurrent debits summing over the balance succeeds', async () => {
    const { service, walletModel, txnModel } = makeService();
    txnModel.create.mockResolvedValue({});

    let balanceMinor = 1000; // 1.000 TND available
    walletModel.findOneAndUpdate.mockImplementation((filter: any) => {
      const requested = filter.$expr.$gte[1] as number;
      const ok = balanceMinor >= requested;
      if (ok) balanceMinor -= requested;
      return {
        exec: () => Promise.resolve(ok ? { userId, balanceMinor } : null),
      };
    });

    const [a, b] = await Promise.allSettled([
      service.debit(userId, 0.7), // 700 minor
      service.debit(userId, 0.7), // 700 minor — combined 1400 > 1000 available
    ]);

    const outcomes = [a, b];
    const fulfilled = outcomes.filter((o) => o.status === 'fulfilled');
    const rejected = outcomes.filter((o) => o.status === 'rejected');
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason).toBeInstanceOf(BadRequestException);
    expect(balanceMinor).toBe(300); // exactly one 700 debit applied to the 1000 starting balance
  });
});
