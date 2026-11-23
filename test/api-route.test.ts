import { describe, expect, it } from 'vitest';
import { route } from '../api/handler';

const appel = (chemin: string, method = 'GET') => route(new Request(`https://demo.vercel.app${chemin}`, { method }));

describe('api/handler (Vercel)', () => {
  it('404 sur une route inconnue', async () => expect((await appel('/api/nope')).status).toBe(404));
  it('405 + Allow quand la méthode ne convient pas', async () => {
    const r = await appel('/api/commande');
    expect(r.status).toBe(405);
    expect(r.headers.get('Allow')).toBe('POST');
    expect((await appel('/api/etat', 'POST')).status).toBe(405);
  });
  it('route les chemins multi-segments via rewrite ?__path=', async () => {
    const r = await appel('/api/handler?__path=auth/me');
    // Sans SUPABASE_URL/SECRET dans les fixtures, gererAuth renvoie 503 (preuve qu'il a bien routé /auth/me et non 404)
    expect(r.status).toBe(503);
  });
});
