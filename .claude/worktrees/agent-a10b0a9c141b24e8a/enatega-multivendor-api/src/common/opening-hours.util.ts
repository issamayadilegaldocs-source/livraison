/**
 * Single source of truth for "is this restaurant open?".
 *
 * Pure function, no Nest/DB dependencies, fully unit-testable. Every client and
 * the order gate consume the result of this evaluator (directly or via the
 * server-computed `isOpen` GraphQL field) so the displayed badge and the
 * placement gate can never disagree.
 *
 * Timezone awareness uses `Intl` (built into Node — no new dependency): the day
 * code and minutes-since-midnight are derived **in the restaurant's zone**, not
 * the host clock. Host-zone dependence is exactly the bug class this removes, so
 * the caller must always pass a resolved zone (its configured default when the
 * restaurant has none); a null/invalid zone here falls back to UTC defensively.
 */

export type OpenReason = 'unavailable' | 'closed-today' | 'closed-now';

export interface OpenStatus {
  isOpen: boolean;
  reason?: OpenReason;
  nextOpenAt?: Date;
}

/** A time slot — canonical `"HH:MM"` strings, with legacy `["HH","MM"]` tolerated. */
export interface OpeningSlot {
  startTime?: string | string[];
  endTime?: string | string[];
}

export interface OpeningDay {
  day?: string;
  times?: OpeningSlot[];
}

export interface EvaluateOpenArgs {
  openingTimes?: OpeningDay[];
  isAvailable?: boolean;
  /** IANA zone (e.g. `Europe/Berlin`); falls back to UTC when null/invalid. */
  timezone?: string | null;
  /** Injectable "now" for tests; defaults to the real clock. */
  now?: Date;
}

const DAY_CODES = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'] as const;
const WEEKDAY_TO_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};
const MINUTES_PER_DAY = 24 * 60;

/** Parses `"HH:MM"` (canonical) or `["HH","MM"]` (legacy) → minutes since midnight, or null. */
function parseSlotTime(value?: string | string[]): number | null {
  let hh: number;
  let mm: number;
  if (Array.isArray(value)) {
    hh = Number(value[0]);
    mm = Number(value[1]);
  } else if (typeof value === 'string') {
    const match = value.match(/^([01]?\d|2[0-3]):([0-5]\d)$/);
    if (!match) return null;
    hh = Number(match[1]);
    mm = Number(match[2]);
  } else {
    return null;
  }
  if (!Number.isInteger(hh) || !Number.isInteger(mm) || hh < 0 || hh > 23 || mm < 0 || mm > 59) {
    return null;
  }
  return hh * 60 + mm;
}

/** Day code + minutes-since-midnight evaluated in the given IANA zone. */
function zonedNow(now: Date, timezone: string): { dayIndex: number; minutes: number } {
  let tz = timezone;
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(now);
  } catch {
    tz = 'UTC';
    parts = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(now);
  }
  const weekday = parts.find((p) => p.type === 'weekday')?.value ?? 'Sun';
  let hour = Number(parts.find((p) => p.type === 'hour')?.value ?? 0);
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? 0);
  // Some ICU builds format midnight as "24"; normalize to 0.
  if (hour === 24) hour = 0;
  return { dayIndex: WEEKDAY_TO_INDEX[weekday] ?? 0, minutes: hour * 60 + minute };
}

/** Normalized [start, end] minutes for a slot, or null when unparseable. */
function slotBounds(slot: OpeningSlot): { start: number; end: number } | null {
  const start = parseSlotTime(slot.startTime);
  const end = parseSlotTime(slot.endTime);
  if (start === null || end === null) return null;
  return { start, end };
}

export function evaluateOpen(args: EvaluateOpenArgs): OpenStatus {
  const { openingTimes, isAvailable, timezone } = args;
  const now = args.now ?? new Date();

  // Manual pause wins over everything (store flipped itself unavailable).
  if (isAvailable === false) return { isOpen: false, reason: 'unavailable' };

  const days = (openingTimes ?? []).filter((d) => d && d.day);
  // Empty / missing schedule → open all hours (matches current backend intent).
  if (!days.length) return { isOpen: true };

  const { dayIndex, minutes } = zonedNow(now, timezone || 'UTC');
  const todayCode = DAY_CODES[dayIndex];
  const yesterdayCode = DAY_CODES[(dayIndex + 6) % 7];

  const slotsFor = (code: string): { start: number; end: number }[] =>
    days
      .filter((d) => d.day === code)
      .flatMap((d) => d.times ?? [])
      .map(slotBounds)
      .filter((b): b is { start: number; end: number } => b !== null);

  const todaySlots = slotsFor(todayCode);
  const hasTodaySchedule = days.some((d) => d.day === todayCode && (d.times?.length ?? 0) > 0);

  for (const { start, end } of todaySlots) {
    if (end > start) {
      // Normal same-day slot (both bounds inclusive, mirroring prior behavior).
      if (minutes >= start && minutes <= end) return { isOpen: true };
    } else {
      // Overnight slot wrapping past midnight (e.g. 18:00–02:00): the evening
      // portion belongs to today.
      if (minutes >= start) return { isOpen: true };
    }
  }

  // Credit yesterday's wrapping slot for the early-morning continuation.
  for (const { start, end } of slotsFor(yesterdayCode)) {
    if (end <= start && minutes <= end) return { isOpen: true };
  }

  const nextOpenAt = computeNextOpenAt(days, dayIndex, minutes, now);
  return {
    isOpen: false,
    reason: hasTodaySchedule ? 'closed-now' : 'closed-today',
    ...(nextOpenAt ? { nextOpenAt } : {}),
  };
}

/**
 * Best-effort next opening moment. Searches today's remaining slot starts and
 * the following 7 days for the earliest start strictly in the future, then adds
 * the elapsed-minute delta to `now`. DST transitions in that window are out of
 * scope (documented), so the delta is treated as wall-clock minutes.
 */
function computeNextOpenAt(
  days: OpeningDay[],
  dayIndex: number,
  minutes: number,
  now: Date,
): Date | undefined {
  let best: number | null = null;
  for (let offset = 0; offset <= 7; offset++) {
    const code = DAY_CODES[(dayIndex + offset) % 7];
    for (const { start } of days
      .filter((d) => d.day === code)
      .flatMap((d) => d.times ?? [])
      .map(slotBounds)
      .filter((b): b is { start: number; end: number } => b !== null)) {
      const absolute = offset * MINUTES_PER_DAY + start;
      // Strictly future relative to the current minute-of-week.
      if (absolute > minutes && (best === null || absolute < best)) best = absolute;
    }
  }
  if (best === null) return undefined;
  return new Date(now.getTime() + (best - minutes) * 60_000);
}
