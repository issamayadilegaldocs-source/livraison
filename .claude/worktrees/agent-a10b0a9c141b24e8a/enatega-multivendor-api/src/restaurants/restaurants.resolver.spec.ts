import { RestaurantsResolver, RestaurantPreviewResolver } from './restaurants.resolver';

const config = { get: () => 'UTC' } as never;

describe('Restaurant open/closed field resolvers', () => {
  beforeAll(() => {
    // Monday 09:00 UTC — inside an 08:00–17:00 Monday slot.
    jest.useFakeTimers().setSystemTime(new Date('2026-06-15T09:00:00Z'));
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  const openToday = [{ day: 'MON', times: [{ startTime: '08:00', endTime: '17:00' }] }];

  it('resolves isOpen on the full Restaurant type from its opening hours', () => {
    const resolver = new RestaurantsResolver({} as never, {} as never, config);
    expect(resolver.isOpen({ openingTimes: openToday, isAvailable: true } as never)).toBe(true);
  });

  it('resolves isOpen on the RestaurantPreview listing type (guards the preview gap)', () => {
    const resolver = new RestaurantPreviewResolver(config);
    expect(resolver.isOpen({ openingTimes: openToday, isAvailable: true } as never)).toBe(true);
    expect(resolver.isOpen({ openingTimes: openToday, isAvailable: false } as never)).toBe(false);
  });

  it('returns the same isOpen value from both resolvers for one restaurant', () => {
    const full = new RestaurantsResolver({} as never, {} as never, config);
    const preview = new RestaurantPreviewResolver(config);
    const r = { openingTimes: openToday, isAvailable: true, timezone: 'UTC' } as never;
    expect(full.isOpen(r)).toBe(preview.isOpen(r));
  });
});
