import { WithdrawMoneyResolver } from './withdraw-money.resolver';

describe('WithdrawMoneyResolver', () => {
  const resolver = new WithdrawMoneyResolver();

  const withdraw = {
    requestAmountMinor: 30000,
    approvedAmountMinor: 25000,
    requestAmountCurrency: 'TND',
    requestAmountScale: 3,
  };

  it('derives request/approved Money from stored minor units and currency metadata', () => {
    expect(resolver.requestAmountMoney(withdraw)).toEqual({
      currency: 'TND',
      scale: 3,
      amount: '30.000',
      minorUnits: '30000',
    });
    expect(resolver.approvedAmountMoney(withdraw)).toEqual({
      currency: 'TND',
      scale: 3,
      amount: '25.000',
      minorUnits: '25000',
    });
  });

  it('returns null for the approved amount when it has not been set yet', () => {
    const pending = {
      requestAmountMinor: 30000,
      requestAmountCurrency: 'TND',
      requestAmountScale: 3,
    };
    expect(resolver.approvedAmountMoney(pending)).toBeNull();
  });

  it('returns null for legacy requests without minor-unit fields', () => {
    const legacy = { requestAmount: 30 };
    expect(resolver.requestAmountMoney(legacy)).toBeNull();
    expect(resolver.approvedAmountMoney(legacy)).toBeNull();
  });
});
