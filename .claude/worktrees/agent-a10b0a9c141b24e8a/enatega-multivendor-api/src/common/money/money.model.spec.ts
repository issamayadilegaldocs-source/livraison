import { toMoneyModel } from './money.model';

describe('toMoneyModel', () => {
  it('maps TND millime minor units to a scale-3 decimal string', () => {
    expect(toMoneyModel(23450, { currency: 'TND', scale: 3 })).toEqual({
      currency: 'TND',
      scale: 3,
      amount: '23.450',
      minorUnits: '23450',
    });
  });

  it('maps USD cent minor units to a scale-2 decimal string', () => {
    expect(toMoneyModel(1005, { currency: 'USD', scale: 2 })).toEqual({
      currency: 'USD',
      scale: 2,
      amount: '10.05',
      minorUnits: '1005',
    });
  });

  it('serializes large minor units as a string without precision loss', () => {
    const huge = 9_007_199_254_740_993n; // > Number.MAX_SAFE_INTEGER
    expect(toMoneyModel(huge, { currency: 'TND', scale: 3 })?.minorUnits).toBe(
      '9007199254740993',
    );
  });

  it('returns zero money for a zero balance', () => {
    expect(toMoneyModel(0, { currency: 'TND', scale: 3 })).toEqual({
      currency: 'TND',
      scale: 3,
      amount: '0.000',
      minorUnits: '0',
    });
  });

  it('returns null when no minor amount is available', () => {
    expect(toMoneyModel(null)).toBeNull();
    expect(toMoneyModel(undefined)).toBeNull();
    expect(toMoneyModel(Number.NaN, { currency: 'TND', scale: 3 })).toBeNull();
  });
});
