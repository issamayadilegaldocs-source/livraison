'use client';

// Cache client complet (mémoire + sessionStorage + déduplication des requêtes simultanées).
// Évite tout rechargement inutile lors de la navigation instantanée entre les écrans.

type Entree<T> = { t: number; v: T };

const mem = new Map<string, Entree<unknown>>();
const enCours = new Map<string, Promise<unknown>>();
const PREFIXE = 'app_cache_v1:';

export function lireCacheSync<T>(cle: string, ttlMs: number): T | null {
  const now = Date.now();
  const m = mem.get(cle);
  if (m && now - m.t < ttlMs) return m.v as T;
  if (typeof window === 'undefined') return null;
  try {
    const brut = sessionStorage.getItem(PREFIXE + cle);
    if (!brut) return null;
    const parsed = JSON.parse(brut) as Entree<T>;
    if (parsed && typeof parsed.t === 'number' && now - parsed.t < ttlMs) {
      mem.set(cle, parsed);
      return parsed.v;
    }
  } catch {
    /* ignore */
  }
  return null;
}

export function ecrireCache<T>(cle: string, valeur: T): void {
  const entree: Entree<T> = { t: Date.now(), v: valeur };
  mem.set(cle, entree);
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(PREFIXE + cle, JSON.stringify(entree));
  } catch {
    /* quota dépassé : le cache mémoire suffit */
  }
}

export function invaliderCache(prefixe = ''): void {
  for (const k of Array.from(mem.keys())) {
    if (!prefixe || k.startsWith(prefixe)) mem.delete(k);
  }
  if (typeof window === 'undefined') return;
  try {
    for (let i = sessionStorage.length - 1; i >= 0; i--) {
      const k = sessionStorage.key(i);
      if (k && k.startsWith(PREFIXE + prefixe)) sessionStorage.removeItem(k);
    }
  } catch {
    /* ignore */
  }
}

/**
 * Fetch JSON avec cache mémoire + sessionStorage + déduplication automatique des appels parallèles.
 * Renvoie `null` en cas d'erreur réseau ou statut non-OK.
 */
export async function fetchCache<T>(
  url: string,
  options: { ttlMs?: number; credentials?: RequestCredentials; forcer?: boolean } = {},
): Promise<T | null> {
  const ttlMs = options.ttlMs ?? 120_000;
  if (!options.forcer) {
    const hit = lireCacheSync<T>(url, ttlMs);
    if (hit !== null) return hit;
  }
  const deja = enCours.get(url);
  if (deja) return deja as Promise<T | null>;

  const prom = fetch(url, { credentials: options.credentials ?? 'same-origin' })
    .then(async (res) => {
      if (!res.ok) return null;
      const data = (await res.json().catch(() => null)) as T | null;
      if (data !== null) ecrireCache(url, data);
      return data;
    })
    .catch(() => null)
    .finally(() => {
      enCours.delete(url);
    });

  enCours.set(url, prom);
  return prom;
}
