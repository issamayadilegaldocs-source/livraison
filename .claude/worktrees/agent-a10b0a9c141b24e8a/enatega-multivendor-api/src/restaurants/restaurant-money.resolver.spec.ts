import { RestaurantMoneyResolver } from './restaurant-money.resolver';

describe('RestaurantMoneyResolver', () => {
  const resolver = new RestaurantMoneyResolver();

  const restaurant = {
    currentWalletAmountMinor: 99999,
    totalWalletAmountMinor: 150000,
    withdrawnWalletAmountMinor: 50001,
    walletAmountCurrency: 'TND',
    walletAmountScale: 3,
  };

  it('derives store wallet total Money fields from stored minor units and currency metadata', () => {
    expect(resolver.currentWalletAmountMoney(restaurant)).toEqual({
      currency: 'TND',
      scale: 3,
      amount: '99.999',
      minorUnits: '99999',
    });
    expect(resolver.totalWalletAmountMoney(restaurant)).toEqual({
      currency: 'TND',
      scale: 3,
      amount: '150.000',
      minorUnits: '150000',
    });
    expect(resolver.withdrawnWalletAmountMoney(restaurant)).toEqual({
      currency: 'TND',
      scale: 3,
      amount: '50.001',
      minorUnits: '50001',
    });
  });

  it('returns null when minor-unit fields are absent', () => {
    const legacy = { currentWalletAmount: 99.99 };
    expect(resolver.currentWalletAmountMoney(legacy)).toBeNull();
  });
});
