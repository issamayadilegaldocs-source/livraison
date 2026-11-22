import { Kind } from 'graphql';
import { normalizeTimeValue, TimeValueScalar } from './time-value.scalar';

describe('TimeValueScalar', () => {
  const scalar = new TimeValueScalar();

  it('normalizes legacy array variables to HH:MM strings', () => {
    expect(scalar.parseValue(['00', '00'])).toBe('00:00');
    expect(scalar.parseValue(['9', '5'])).toBe('09:05');
  });

  it('accepts canonical HH:MM string variables', () => {
    expect(scalar.parseValue('23:59')).toBe('23:59');
  });

  it('normalizes legacy array literals to HH:MM strings', () => {
    expect(
      scalar.parseLiteral({
        kind: Kind.LIST,
        values: [
          { kind: Kind.STRING, value: '09' },
          { kind: Kind.STRING, value: '30' },
        ],
      }),
    ).toBe('09:30');
  });

  it('rejects malformed time values', () => {
    expect(() => scalar.parseValue(['24', '00'])).toThrow('Time values must match HH:MM');
    expect(() => scalar.parseValue(['09'])).toThrow('Time values must be "HH:MM" strings');
  });
});

describe('normalizeTimeValue', () => {
  it('returns undefined for absent optional values', () => {
    expect(normalizeTimeValue(undefined)).toBeUndefined();
    expect(normalizeTimeValue(null)).toBeUndefined();
  });
});
