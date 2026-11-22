import { DashboardService } from './dashboard.service';

const makeService = (overrides: Partial<Record<string, unknown>> = {}) =>
  new DashboardService(
    (overrides.orderModel ?? {}) as never,
    (overrides.restaurantModel ?? {}) as never,
    (overrides.userModel ?? {}) as never,
    (overrides.riderModel ?? {}) as never,
    (overrides.ownerModel ?? {}) as never,
  );

describe('DashboardService.buildDateRange (private helper)', () => {
  const call = (start?: string, end?: string, keyword?: string) =>
    (makeService() as any).buildDateRange(start, end, keyword);

  it('returns null when no date filter is provided at all', () => {
    expect(call()).toBeNull();
  });

  it('resolves "today" to midnight-to-midnight', () => {
    const range = call(undefined, undefined, 'today');
    expect(range.to.getTime() - range.from.getTime()).toBe(86_400_000);
  });

  it('resolves "yesterday" to the day before today', () => {
    const today = call(undefined, undefined, 'today');
    const yesterday = call(undefined, undefined, 'yesterday');
    expect(yesterday.to.getTime()).toBe(today.from.getTime());
    expect(today.from.getTime() - yesterday.from.getTime()).toBe(86_400_000);
  });

  it('resolves "month"/"this month"/"monthly" to the same range regardless of casing/alias', () => {
    const a = call(undefined, undefined, 'month');
    const b = call(undefined, undefined, 'This Month');
    const c = call(undefined, undefined, 'monthly');
    expect(a.from.getMonth()).toBe(b.from.getMonth());
    expect(a.from.getDate()).toBe(1);
    expect(c.from.getDate()).toBe(1);
  });

  it('resolves "year" to January 1st of the current year', () => {
    const range = call(undefined, undefined, 'year');
    expect(range.from.getMonth()).toBe(0);
    expect(range.from.getDate()).toBe(1);
  });

  it('falls back to explicit startingDate/endingDate when no keyword matches', () => {
    const range = call('2026-01-01', '2026-01-31', undefined);
    expect(range.from.toISOString()).toBe('2026-01-01T00:00:00.000Z');
    expect(range.to.toISOString()).toBe('2026-01-31T00:00:00.000Z');
  });

  it('defaults a missing startingDate to the epoch and a missing endingDate to now', () => {
    const before = Date.now();
    const range = call(undefined, '2026-01-31', undefined);
    expect(range.from.getTime()).toBe(0);
    const rangeEndOnly = call('2026-01-01', undefined, undefined);
    expect(rangeEndOnly.to.getTime()).toBeGreaterThanOrEqual(before);
  });

  it('ignores an unrecognized keyword and falls through to explicit dates or null', () => {
    expect(call(undefined, undefined, 'not-a-real-keyword')).toBeNull();
    expect(call('2026-01-01', undefined, 'not-a-real-keyword').from.toISOString()).toBe(
      '2026-01-01T00:00:00.000Z',
    );
  });
});

describe('DashboardService.pct (private helper — period-over-period % change)', () => {
  const pct = (curr: number, prev: number) => (makeService() as any).pct(curr, prev);

  it('computes a positive percentage increase', () => {
    expect(pct(150, 100)).toBe(50);
  });

  it('computes a negative percentage decrease', () => {
    expect(pct(50, 100)).toBe(-50);
  });

  it('returns 0 when both current and previous are zero (no growth, not a divide-by-zero)', () => {
    expect(pct(0, 0)).toBe(0);
  });

  it('returns 100 when growing from zero to any positive value (cannot compute a ratio from zero)', () => {
    expect(pct(25, 0)).toBe(100);
  });

  it('rounds to 2 decimal places', () => {
    expect(pct(103, 97)).toBeCloseTo(6.19, 2);
  });
});

describe('DashboardService vendor-scoped queries with no restaurants', () => {
  const ownerModelWithNoRestaurants = {
    findById: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue({ restaurants: [] }),
    }),
  };

  it('getStoreDetailsByVendorId returns an empty array for a vendor with no restaurants', async () => {
    const service = makeService({ ownerModel: ownerModelWithNoRestaurants });
    await expect(service.getStoreDetailsByVendorId('vendor_1')).resolves.toEqual([]);
  });

  it('getVendorDashboardStatsCardDetails returns zeroed stats for a vendor with no restaurants', async () => {
    const service = makeService({ ownerModel: ownerModelWithNoRestaurants });
    await expect(service.getVendorDashboardStatsCardDetails('vendor_1')).resolves.toEqual({
      totalRestaurants: 0,
      totalOrders: 0,
      totalSales: 0,
      totalDeliveries: 0,
    });
  });

  it('getLiveMonitorData returns zeroed live-monitor stats for a vendor with no restaurants', async () => {
    const service = makeService({ ownerModel: ownerModelWithNoRestaurants });
    await expect(service.getLiveMonitorData('vendor_1')).resolves.toEqual({
      online_stores: 0,
      cancelled_orders: 0,
      delayed_orders: 0,
      ratings: 0,
    });
  });

  it('getVendorDashboardGrowthDetailsByYear returns 12 zeroed months for a vendor with no restaurants', async () => {
    const service = makeService({ ownerModel: ownerModelWithNoRestaurants });
    const result = await service.getVendorDashboardGrowthDetailsByYear('vendor_1', 2026);
    expect(result.totalRestaurants).toHaveLength(12);
    expect(result.totalOrders.every((v: number) => v === 0)).toBe(true);
  });
});
