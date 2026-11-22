import { ConfigurationMoneyResolver } from './configuration-money.resolver';

describe('ConfigurationMoneyResolver', () => {
  const resolver = new ConfigurationMoneyResolver();

  const config = {
    currency: 'TND',
    currencyDecimalDigits: 3,
    deliveryRateMinor: 2500,
    baseDeliveryFeeMinor: 1000,
    deliveryFeeMinimumMinor: 2000,
    deliveryFeeMaximumMinor: 6000,
    serviceFeeMinimumMinor: 700,
    serviceFeeMaximumMinor: 5000,
    deliveryBonusMaxMinor: 3500,
    expressSurchargeMinor: 3500,
  };

  it('derives configured price Money fields at the configured currency scale', () => {
    expect(resolver.deliveryRateMoney(config)).toEqual({
      currency: 'TND',
      scale: 3,
      amount: '2.500',
      minorUnits: '2500',
    });
    expect(resolver.baseDeliveryFeeMoney(config)).toEqual({
      currency: 'TND',
      scale: 3,
      amount: '1.000',
      minorUnits: '1000',
    });
    expect(resolver.expressSurchargeMoney(config)).toEqual({
      currency: 'TND',
      scale: 3,
      amount: '3.500',
      minorUnits: '3500',
    });
    expect(resolver.deliveryFeeMinimumMoney(config)?.amount).toBe('2.000');
    expect(resolver.deliveryFeeMaximumMoney(config)?.amount).toBe('6.000');
    expect(resolver.serviceFeeMinimumMoney(config)?.amount).toBe('0.700');
    expect(resolver.serviceFeeMaximumMoney(config)?.amount).toBe('5.000');
    expect(resolver.deliveryBonusMaxMoney(config)?.amount).toBe('3.500');
  });

  it('returns null when configured price minor fields are absent', () => {
    const legacy = { currency: 'USD', currencyDecimalDigits: 2 };
    expect(resolver.deliveryRateMoney(legacy)).toBeNull();
    expect(resolver.baseDeliveryFeeMoney(legacy)).toBeNull();
    expect(resolver.expressSurchargeMoney(legacy)).toBeNull();
    expect(resolver.serviceFeeMinimumMoney(legacy)).toBeNull();
    expect(resolver.deliveryBonusMaxMoney(legacy)).toBeNull();
  });
});
