import { evaluateOpen } from './opening-hours.util';

// A fixed UTC instant we can reason about. 2026-06-15 is a Monday.
// 10:00 UTC == 12:00 in Europe/Berlin (CEST, UTC+2).
const mondayMorningUtc = new Date('2026-06-15T10:00:00Z');

const day = (d: string, slots: [string, string][]) => ({
  day: d,
  times: slots.map(([startTime, endTime]) => ({ startTime, endTime })),
});

describe('evaluateOpen', () => {
  it('is open with an empty / missing schedule (allow all hours)', () => {
    expect(evaluateOpen({ openingTimes: [], timezone: 'UTC', now: mondayMorningUtc }).isOpen).toBe(true);
    expect(evaluateOpen({ timezone: 'UTC', now: mondayMorningUtc }).isOpen).toBe(true);
  });

  it('is open 24/7 (00:00–23:59 every day)', () => {
    const openingTimes = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'].map((d) =>
      day(d, [['00:00', '23:59']]),
    );
    expect(evaluateOpen({ openingTimes, timezone: 'UTC', now: mondayMorningUtc }).isOpen).toBe(true);
  });

  it('manual pause (isAvailable:false) wins over open hours', () => {
    const openingTimes = [day('MON', [['00:00', '23:59']])];
    const status = evaluateOpen({ openingTimes, isAvailable: false, timezone: 'UTC', now: mondayMorningUtc });
    expect(status).toMatchObject({ isOpen: false, reason: 'unavailable' });
  });

  it('reports closed-today when there is no slot for the current day', () => {
    const openingTimes = [day('TUE', [['09:00', '17:00']])]; // now is Monday
    const status = evaluateOpen({ openingTimes, timezone: 'UTC', now: mondayMorningUtc });
    expect(status).toMatchObject({ isOpen: false, reason: 'closed-today' });
  });

  it('reports closed-now before open and after close', () => {
    const before = evaluateOpen({
      openingTimes: [day('MON', [['11:00', '17:00']])],
      timezone: 'UTC',
      now: mondayMorningUtc, // 10:00 UTC
    });
    expect(before).toMatchObject({ isOpen: false, reason: 'closed-now' });

    const after = evaluateOpen({
      openingTimes: [day('MON', [['07:00', '09:00']])],
      timezone: 'UTC',
      now: mondayMorningUtc,
    });
    expect(after).toMatchObject({ isOpen: false, reason: 'closed-now' });
  });

  it('treats start and end boundaries as inclusive', () => {
    const atStart = evaluateOpen({
      openingTimes: [day('MON', [['10:00', '17:00']])],
      timezone: 'UTC',
      now: mondayMorningUtc, // exactly 10:00
    });
    expect(atStart.isOpen).toBe(true);

    const atEnd = evaluateOpen({
      openingTimes: [day('MON', [['07:00', '10:00']])],
      timezone: 'UTC',
      now: mondayMorningUtc, // exactly 10:00
    });
    expect(atEnd.isOpen).toBe(true);
  });

  describe('overnight wrap (18:00–02:00)', () => {
    const openingTimes = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'].map((d) =>
      day(d, [['18:00', '02:00']]),
    );

    it('is open at 01:00 (early-morning continuation of yesterday)', () => {
      const at0100 = new Date('2026-06-15T01:00:00Z'); // Monday 01:00 UTC
      expect(evaluateOpen({ openingTimes, timezone: 'UTC', now: at0100 }).isOpen).toBe(true);
    });

    it('is open at 23:00 (evening portion of today)', () => {
      const at2300 = new Date('2026-06-15T23:00:00Z');
      expect(evaluateOpen({ openingTimes, timezone: 'UTC', now: at2300 }).isOpen).toBe(true);
    });

    it('is closed at 10:00 (between the morning close and evening open)', () => {
      expect(evaluateOpen({ openingTimes, timezone: 'UTC', now: mondayMorningUtc }).isOpen).toBe(false);
    });
  });

  it('evaluates hours in the restaurant timezone, not the host clock', () => {
    // 10:00 UTC is 12:00 in Berlin. A Berlin restaurant open 11:00–14:00 (local)
    // is open; the same wall-clock judged in UTC would be closed (10:00 < 11:00).
    const openingTimes = [day('MON', [['11:00', '14:00']])];
    expect(evaluateOpen({ openingTimes, timezone: 'Europe/Berlin', now: mondayMorningUtc }).isOpen).toBe(true);
    expect(evaluateOpen({ openingTimes, timezone: 'UTC', now: mondayMorningUtc }).isOpen).toBe(false);
  });

  it('crosses the day boundary correctly across timezones', () => {
    // 23:30 UTC on Sunday is 01:30 Monday in Berlin. A Berlin restaurant with a
    // Monday 01:00–03:00 slot is open; the UTC day is still Sunday.
    const sundayLateUtc = new Date('2026-06-14T23:30:00Z'); // Sunday 23:30 UTC
    const openingTimes = [day('MON', [['01:00', '03:00']])];
    expect(evaluateOpen({ openingTimes, timezone: 'Europe/Berlin', now: sundayLateUtc }).isOpen).toBe(true);
  });

  it('tolerates legacy ["HH","MM"] array slots', () => {
    const openingTimes = [{ day: 'MON', times: [{ startTime: ['09', '00'], endTime: ['17', '00'] }] }];
    expect(evaluateOpen({ openingTimes: openingTimes as any, timezone: 'UTC', now: mondayMorningUtc }).isOpen).toBe(true);
  });

  it('computes nextOpenAt when currently closed', () => {
    const status = evaluateOpen({
      openingTimes: [day('MON', [['11:00', '17:00']])],
      timezone: 'UTC',
      now: mondayMorningUtc, // 10:00 UTC, opens at 11:00 UTC
    });
    expect(status.isOpen).toBe(false);
    expect(status.nextOpenAt?.toISOString()).toBe('2026-06-15T11:00:00.000Z');
  });

  it('falls back to UTC for an invalid timezone instead of throwing', () => {
    const openingTimes = [day('MON', [['10:00', '11:00']])];
    expect(() =>
      evaluateOpen({ openingTimes, timezone: 'Not/AZone', now: mondayMorningUtc }),
    ).not.toThrow();
    expect(evaluateOpen({ openingTimes, timezone: 'Not/AZone', now: mondayMorningUtc }).isOpen).toBe(true);
  });
});
