import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { OrderItemInput } from './place-order.input';

const validate = (raw: Record<string, unknown>) =>
  validateSync(plainToInstance(OrderItemInput, raw), { whitelist: true });

describe('OrderItemInput.quantity validation (ITM)', () => {
  const base = { food: 'food_1', variation: 'var_1' };

  it('accepts a positive integer quantity', () => {
    expect(validate({ ...base, quantity: 3 })).toHaveLength(0);
  });

  it('ITM-03: rejects a negative quantity', () => {
    const errors = validate({ ...base, quantity: -1 });
    expect(errors.some((e) => e.property === 'quantity')).toBe(true);
  });

  it('ITM-02: rejects a zero quantity', () => {
    const errors = validate({ ...base, quantity: 0 });
    expect(errors.some((e) => e.property === 'quantity')).toBe(true);
  });

  it('ITM-14: rejects a fractional quantity', () => {
    const errors = validate({ ...base, quantity: 2.5 });
    expect(errors.some((e) => e.property === 'quantity')).toBe(true);
  });
});
