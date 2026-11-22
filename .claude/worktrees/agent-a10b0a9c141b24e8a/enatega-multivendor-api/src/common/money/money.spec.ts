import { BadRequestException } from '@nestjs/common';
import { Money } from './money';

describe('Money', () => {
  it('stores decimal amounts as integer minor units at the currency scale', () => {
    const money = Money.fromDecimal('12.3456', { currency: 'TND', scale: 3 });

    expect(money.currency).toBe('TND');
    expect(money.scale).toBe(3);
    expect(money.toMinor()).toBe(12346n);
    expect(money.toDecimalString()).toBe('12.346');
    expect(money.toNumber()).toBe(12.346);
  });

  it('rounds half to even instead of always rounding up', () => {
    expect(Money.fromDecimal('1.005', { currency: 'USD', scale: 2 }).toDecimalString()).toBe(
      '1.00',
    );
    expect(Money.fromDecimal('1.015', { currency: 'USD', scale: 2 }).toDecimalString()).toBe(
      '1.02',
    );
    expect(Money.fromDecimal('2.345', { currency: 'TND', scale: 2 }).toDecimalString()).toBe(
      '2.34',
    );
    expect(Money.fromDecimal('2.355', { currency: 'TND', scale: 2 }).toDecimalString()).toBe(
      '2.36',
    );
  });

  it('adds and subtracts only matching currency/scale values', () => {
    const a = Money.fromDecimal('1.200', { currency: 'TND', scale: 3 });
    const b = Money.fromDecimal('0.300', { currency: 'TND', scale: 3 });

    expect(a.add(b).toDecimalString()).toBe('1.500');
    expect(a.subtract(b).toDecimalString()).toBe('0.900');
    expect(() => a.add(Money.fromDecimal('1.20', { currency: 'USD', scale: 2 }))).toThrow(
      BadRequestException,
    );
  });

  it('multiplies with half-even rounding at the original currency scale', () => {
    expect(Money.fromDecimal('10.005', { currency: 'TND', scale: 3 }).multiply('0.5').toDecimalString()).toBe(
      '5.002',
    );
  });
});
