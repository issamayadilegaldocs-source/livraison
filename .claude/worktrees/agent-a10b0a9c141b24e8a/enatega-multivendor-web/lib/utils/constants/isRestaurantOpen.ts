// Display-only offline fallback. The server now computes `restaurant.isOpen`
// (timezone-correct, single source of truth) — prefer it everywhere and only
// fall back to this local computation when the field is missing (e.g. an older
// cached query). The order/placement gate stays server-side.
//
// The backend stores slot times as canonical "HH:MM" strings. This previously
// assumed ["HH","MM"] arrays and called `.map(Number)`, which threw / always
// read closed on real data — fixed here to parse strings (arrays tolerated for
// any legacy rows).

export type SlotTime = string | [string, string];

export interface OpeningSlot {
  startTime: SlotTime; // "09:00" (canonical) or ["09","00"] (legacy)
  endTime: SlotTime;
}

export interface OpeningTime {
  day: string; // "MON"
  times: OpeningSlot[];
}

export interface Restaurant {
  _id: string;
  name: string;
  image: string;
  address: string;
  reviewAverage: number;
  reviewCount: number;
  shopType: string;
  slug: string;

  isAvailable?: boolean;
  isActive?: boolean;
  // Server-computed status — when present, callers should use this directly.
  isOpen?: boolean;

  location: {
    coordinates: [number, number]; // [lng, lat]
  };

  openingTimes: OpeningTime[];
}

/** Parses "HH:MM" or ["HH","MM"] → minutes since midnight, or null. */
function toMinutes(value: SlotTime): number | null {
  let hh: number;
  let mm: number;
  if (Array.isArray(value)) {
    hh = Number(value[0]);
    mm = Number(value[1]);
  } else if (typeof value === "string" && /^\d{1,2}:\d{2}$/.test(value)) {
    const [h, m] = value.split(":");
    hh = Number(h);
    mm = Number(m);
  } else {
    return null;
  }
  if (!Number.isInteger(hh) || !Number.isInteger(mm)) return null;
  return hh * 60 + mm;
}

export function isRestaurantOpen(restaurant: Restaurant): boolean {
  if (!restaurant) return false;
  // Prefer the authoritative server field when available.
  if (typeof restaurant.isOpen === "boolean") return restaurant.isOpen;

  if (restaurant.isAvailable === false || restaurant.isActive === false) return false;

  const openingTimes = restaurant.openingTimes || [];
  // No schedule configured → treat as open (matches backend "allow all hours").
  if (!openingTimes.length) return true;

  const now = new Date();
  const currentDay = now
    .toLocaleString("en-US", { weekday: "short" })
    .toUpperCase();
  const nowTotal = now.getHours() * 60 + now.getMinutes();

  const todayOpening = openingTimes.find((ot) => ot.day === currentDay);
  if (!todayOpening) return false;

  return todayOpening.times.some(({ startTime, endTime }) => {
    const start = toMinutes(startTime);
    const end = toMinutes(endTime);
    if (start === null || end === null) return false;
    // Overnight slot (e.g. 18:00–02:00) wraps past midnight.
    if (end <= start) return nowTotal >= start || nowTotal <= end;
    return nowTotal >= start && nowTotal <= end;
  });
}
