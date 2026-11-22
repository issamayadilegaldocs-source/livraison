import { RiderMoneyResolver } from './rider-money.resolver';

describe('RiderMoneyResolver', () => {
  const resolver = new RiderMoneyResolver();

  const rider = {
    currentWalletAmountMinor: 12500,
    totalWalletAmountMinor: 40000,
    withdrawnWalletAmountMinor: 27500,
    walletAmountCurrency: 'TND',
    walletAmountScale: 3,
  };

  it('derives wallet total Money fields from stored minor units and currency metadata', () => {
    expect(resolver.currentWalletAmountMoney(rider)).toEqual({
      currency: 'TND',
      scale: 3,
      amount: '12.500',
      minorUnits: '12500',
    });
    expect(resolver.totalWalletAmountMoney(rider)).toEqual({
      currency: 'TND',
      scale: 3,
      amount: '40.000',
      minorUnits: '40000',
    });
    expect(resolver.withdrawnWalletAmountMoney(rider)).toEqual({
      currency: 'TND',
      scale: 3,
      amount: '27.500',
      minorUnits: '27500',
    });
  });

  it('returns null when minor-unit fields are absent', () => {
    const legacy = { currentWalletAmount: 12.5 };
    expect(resolver.currentWalletAmountMoney(legacy)).toBeNull();
    expect(resolver.totalWalletAmountMoney(legacy)).toBeNull();
    expect(resolver.withdrawnWalletAmountMoney(legacy)).toBeNull();
  });
});
