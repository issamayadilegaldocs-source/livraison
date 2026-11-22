import { OrderMoneyResolver } from './order-money.resolver';

describe('OrderMoneyResolver', () => {
  const resolver = new OrderMoneyResolver();

  const order = {
    orderAmountMinor: 23450,
    paidAmountMinor: 23450,
    deliveryChargesMinor: 1500,
    tippingMinor: 0,
    riderCommissionMinor: 750,
    subtotalMinor: 21000,
    serviceFeeMinor: 700,
    deliveryBonusMinor: 350,
    orderAmountCurrency: 'TND',
    orderAmountScale: 3,
  };

  it('derives the order total Money from stored minor units and currency metadata', () => {
    expect(resolver.orderAmountMoney(order)).toEqual({
      currency: 'TND',
      scale: 3,
      amount: '23.450',
      minorUnits: '23450',
    });
  });

  it('derives component Money fields at the order currency scale', () => {
    expect(resolver.deliveryChargesMoney(order)).toEqual({
      currency: 'TND',
      scale: 3,
      amount: '1.500',
      minorUnits: '1500',
    });
    expect(resolver.tippingMoney(order)).toEqual({
      currency: 'TND',
      scale: 3,
      amount: '0.000',
      minorUnits: '0',
    });
    expect(resolver.riderCommissionMoney(order)).toEqual({
      currency: 'TND',
      scale: 3,
      amount: '0.750',
      minorUnits: '750',
    });
    expect(resolver.subtotalMoney(order)?.amount).toBe('21.000');
    expect(resolver.serviceFeeMoney(order)?.amount).toBe('0.700');
    expect(resolver.deliveryBonusMoney(order)?.amount).toBe('0.350');
  });

  it('returns null for legacy orders that have no minor-unit fields', () => {
    const legacy = { orderAmount: 23.45 };
    expect(resolver.orderAmountMoney(legacy)).toBeNull();
    expect(resolver.paidAmountMoney(legacy)).toBeNull();
    expect(resolver.discountAmountMoney(legacy)).toBeNull();
    expect(resolver.serviceFeeMoney(legacy)).toBeNull();
    expect(resolver.deliveryBonusMoney(legacy)).toBeNull();
  });
});
