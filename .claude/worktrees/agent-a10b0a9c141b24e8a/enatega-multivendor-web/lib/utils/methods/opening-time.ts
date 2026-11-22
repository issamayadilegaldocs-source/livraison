import { IOpeningTime } from "@/lib/utils/interfaces";

/**
 * The API's TimeValue scalar serializes opening times as canonical "HH:MM"
 * strings, but historical documents (and the legacy API) shipped
 * ["HH", "MM"] string arrays — and this codebase used to assume ONLY the
 * array shape, crashing the whole discovery page with
 * `startTime.map is not a function` the moment a restaurant card rendered.
 * Accept both shapes and never throw: an unparseable time slot is treated
 * as "closed for that slot" rather than taking down the page.
 */
export function parseTimeToMinutes(value: unknown): number | null {
  if (typeof value === "string") {
    const [h, m] = value.split(":");
    const hour = Number(h);
    const minute = Number(m ?? 0);
    if (Number.isFinite(hour) && Number.isFinite(minute)) return hour * 60 + minute;
    return null;
  }
  if (Array.isArray(value)) {
    const hour = Number(value[0]);
    const minute = Number(value[1] ?? 0);
    if (Number.isFinite(hour) && Number.isFinite(minute)) return hour * 60 + minute;
    return null;
  }
  return null;
}

/** True when `now` falls inside one of today's opening slots. */
export function isWithinOpeningTime(
  openingTimes: IOpeningTime[] | undefined | null,
  now: Date = new Date(),
): boolean {
  if (!openingTimes?.length) return false;
  const currentDay = now
    .toLocaleString("en-US", { weekday: "short" })
    .toUpperCase(); // "MON", "TUE", …

  const todayOpening = openingTimes.find((ot) => ot?.day === currentDay);
  if (!todayOpening?.times?.length) return false;

  const nowTotal = now.getHours() * 60 + now.getMinutes();
  return todayOpening.times.some((slot) => {
    const startTotal = parseTimeToMinutes(slot?.startTime);
    const endTotal = parseTimeToMinutes(slot?.endTime);
    if (startTotal === null || endTotal === null) return false;
    return nowTotal >= startTotal && nowTotal <= endTotal;
  });
}
