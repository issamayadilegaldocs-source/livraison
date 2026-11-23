import { afterEach, describe, expect, it, vi } from 'vitest';
import { ecrireCache, fetchCache, invaliderCache, lireCacheSync } from './cache-client';

afterEach(() => {
  invaliderCache();
  vi.restoreAllMocks();
});

describe('cache-client (mémoire + déduplication)', () => {
  it('déduplique les requêtes simultanées et sert le cache sans rappeler fetch', async () => {
    const spy = vi.spyOn(globalThis, 'fetch').mockImplementation(
      async () => new Response(JSON.stringify({ ok: 1 }), { status: 200, headers: { 'content-type': 'application/json' } }),
    );

    const [a, b] = await Promise.all([
      fetchCache<{ ok: number }>('/api/demo', { ttlMs: 60_000 }),
      fetchCache<{ ok: number }>('/api/demo', { ttlMs: 60_000 }),
    ]);
    expect(a).toEqual({ ok: 1 });
    expect(b).toEqual({ ok: 1 });
    expect(spy).toHaveBeenCalledTimes(1);

    const c = await fetchCache<{ ok: number }>('/api/demo', { ttlMs: 60_000 });
    expect(c).toEqual({ ok: 1 });
    expect(spy).toHaveBeenCalledTimes(1);
    expect(lireCacheSync('/api/demo', 60_000)).toEqual({ ok: 1 });
  });

  it('invaliderCache purge par préfixe', () => {
    ecrireCache('/api/auth/me', { user: { id: '1' } });
    ecrireCache('/api/etat', { pause: false });
    invaliderCache('/api/auth/');
    expect(lireCacheSync('/api/auth/me', 60_000)).toBeNull();
    expect(lireCacheSync('/api/etat', 60_000)).toEqual({ pause: false });
  });
});
