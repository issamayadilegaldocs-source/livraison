import { NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';
import { RidersService } from './riders.service';

const query = (resolved: unknown) => {
  const q: any = {};
  for (const m of ['findOne', 'findByIdAndUpdate', 'populate', 'lean']) {
    q[m] = jest.fn().mockReturnValue(q);
  }
  q.exec = jest.fn().mockResolvedValue(resolved);
  return q;
};

describe('RidersService wallet ports', () => {
  const makeService = (riderModel: any) => new RidersService(riderModel);

  it('resolves a rider Mongo id from Clerk id', async () => {
    const id = new Types.ObjectId();
    const findOne = jest.fn().mockReturnValue(query({ _id: id }));
    const service = makeService({ findOne });

    await expect(service.resolveMongoIdByClerkId('rider_1')).resolves.toBe(String(id));
    expect(findOne).toHaveBeenCalledWith({ clerkId: 'rider_1' }, '_id');
  });

  it('throws when a rider Clerk id is missing', async () => {
    const service = makeService({ findOne: jest.fn().mockReturnValue(query(null)) });

    await expect(service.resolveMongoIdByClerkId('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('returns wallet context for withdraw checks', async () => {
    const id = new Types.ObjectId();
    const findOne = jest.fn().mockReturnValue(query({ _id: id, currentWalletAmount: 42, currentWalletAmountMinor: 4200 }));
    const service = makeService({ findOne });

    await expect(service.getWalletContext('rider_1')).resolves.toEqual({
      id: String(id),
      currentWalletAmount: 42,
      currentWalletAmountMinor: 4200,
    });
    expect(findOne).toHaveBeenCalledWith({ clerkId: 'rider_1' }, '_id currentWalletAmount currentWalletAmountMinor');
  });

  it('returns null wallet context when no rider is linked', async () => {
    const service = makeService({ findOne: jest.fn().mockReturnValue(query(null)) });

    await expect(service.getWalletContext('missing')).resolves.toBeNull();
  });

  it('debits rider wallet for withdrawal with the correct deltas', async () => {
    const findByIdAndUpdate = jest.fn().mockResolvedValue(null);
    const service = makeService({ findByIdAndUpdate });

    await service.debitWalletForWithdrawal('rider_id', 25, 25000, { currency: 'TND', scale: 3 });

    expect(findByIdAndUpdate).toHaveBeenCalledWith(
      'rider_id',
      expect.arrayContaining([
        expect.objectContaining({
          $set: expect.objectContaining({
            currentWalletAmountMinor: expect.objectContaining({
              $add: expect.arrayContaining([-25000]),
            }),
            withdrawnWalletAmountMinor: expect.objectContaining({
              $add: expect.arrayContaining([25000]),
            }),
            walletAmountCurrency: 'TND',
            walletAmountScale: 3,
          }),
        }),
      ]),
    );
  });

  it('credits rider wallet for withdrawal refund with the correct deltas', async () => {
    const findByIdAndUpdate = jest.fn().mockResolvedValue(null);
    const service = makeService({ findByIdAndUpdate });

    await service.creditWalletForWithdrawal('rider_id', 25, 25000, { currency: 'TND', scale: 3 });

    expect(findByIdAndUpdate).toHaveBeenCalledWith(
      'rider_id',
      expect.arrayContaining([
        expect.objectContaining({
          $set: expect.objectContaining({
            currentWalletAmountMinor: expect.objectContaining({
              $add: expect.arrayContaining([25000]),
            }),
            withdrawnWalletAmountMinor: expect.objectContaining({
              $add: expect.arrayContaining([-25000]),
            }),
            walletAmountCurrency: 'TND',
            walletAmountScale: 3,
          }),
        }),
      ]),
    );
  });
});
