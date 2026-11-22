import { describe, expect, it } from 'vitest';
import { route } from '../api/[...slug]';

const appel = (chemin: string, method = 'GET') => route(new Request(`https://demo.vercel.app${chemin}`, { method }));

describe('api/[...slug] (Vercel)', () => {
  it('404 sur une route inconnue', async () => expect((await appel('/api/nope')).status).toBe(404));
  it('405 + Allow quand la méthode ne convient pas', async () => {
    const r = await appel('/api/commande');
    expect(r.status).toBe(405);
    expect(r.headers.get('Allow')).toBe('POST');
    expect((await appel('/api/etat', 'POST')).status).toBe(405);
  });
});
