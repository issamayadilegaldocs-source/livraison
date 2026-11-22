import { haversineKm } from './haversine';

describe('haversineKm (shared util)', () => {
  it('returns ~0 for identical points', () => {
    expect(haversineKm(34.74, 10.76, 34.74, 10.76)).toBeCloseTo(0, 5);
  });

  it('computes a known Sfax-area distance (~1.5 km)', () => {
    const d = haversineKm(34.7406, 10.7603, 34.7541, 10.7603);
    expect(d).toBeGreaterThan(1.4);
    expect(d).toBeLessThan(1.6);
  });

  it('returns 0 for any non-finite coordinate (malformed input)', () => {
    expect(haversineKm(NaN, 10, 34, 10)).toBe(0);
    expect(haversineKm(34, 10, Infinity, 10)).toBe(0);
    // @ts-expect-error deliberately passing a bad type
    expect(haversineKm(undefined, 10, 34, 10)).toBe(0);
  });
});
