import { afterEach, describe, expect, it, vi } from 'vitest';
import { genererCodeParrainage, gererAvis, gererChat, gererSupport } from './app-features';
import { getLivreur } from './livreur';

const envMock = {
  SUPABASE_URL: 'https://demo.supabase.co',
  SUPABASE_SECRET_KEY: 'sb_secret_test',
};

const livreur = getLivreur();

afterEach(() => {
  vi.restoreAllMocks();
});

describe('app-features (avis, chat, parrainage, support)', () => {
  it('genererCodeParrainage produit un code lisible sans accents', () => {
    const code = genererCodeParrainage('Émile Test');
    expect(code).toMatch(/^[A-Z0-9]{1,4}-[A-Z0-9]{4}$/);
  });

  it('GET /api/avis calcule la moyenne et la répartition', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify([
          { id: '1', resto_slug: 'chap-lab', resto_nom: 'Chap Lab', note: 5, commentaire: 'Top', client_nom: 'Sami', visible: true, created_at: '2026-11-23T10:00:00Z' },
          { id: '2', resto_slug: 'chap-lab', resto_nom: 'Chap Lab', note: 3, commentaire: 'Bien', client_nom: 'Ali', visible: true, created_at: '2026-11-23T11:00:00Z' },
        ]),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );
    const res = await gererAvis(new Request('https://site.test/api/avis?resto=chap-lab'), envMock);
    expect(res.status).toBe(200);
    const d = await res.json();
    expect(d.moyenne).toBe(4);
    expect(d.total).toBe(2);
    expect(d.repartition[5]).toBe(1);
    expect(d.repartition[3]).toBe(1);
  });

  it('POST /api/chat autorise un client invité avec ref + téléphone et refuse un inconnu', async () => {
    const cmdRow = {
      id: 'cmd-1',
      ref: 'TEST01',
      titre: 'Chap Lab',
      statut: 'en_livraison',
      client_nom: 'Sami',
      client_telephone: '21622111222',
      livreur_nom: 'Karim',
    };
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes('/rest/v1/commandes')) {
        return new Response(JSON.stringify([cmdRow]), { status: 200, headers: { 'content-type': 'application/json' } });
      }
      if (url.includes('/rest/v1/chat_commandes')) {
        return new Response(
          JSON.stringify([{ id: 'm1', commande_id: 'cmd-1', sender_role: 'client', sender_nom: 'Sami', message: 'Je suis en bas', created_at: '2026-11-23T12:00:00Z' }]),
          { status: 201, headers: { 'content-type': 'application/json' } },
        );
      }
      return new Response('[]', { status: 200 });
    });

    const interdit = await gererChat(
      new Request('https://site.test/api/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ commande_id: 'cmd-1', message: 'Salut', ref: 'TEST01', tel: '99999999' }),
      }),
      envMock,
    );
    expect(interdit.status).toBe(403);

    const ok = await gererChat(
      new Request('https://site.test/api/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ commande_id: 'cmd-1', message: 'Je suis en bas', ref: 'TEST01', tel: '22111222' }),
      }),
      envMock,
    );
    expect(ok.status).toBe(201);
    expect((await ok.json()).message.message).toBe('Je suis en bas');
    expect(fetchSpy).toHaveBeenCalled();
  });

  it('GET /api/support exige une session connectée', async () => {
    const res = await gererSupport(new Request('https://site.test/api/support'), envMock, livreur);
    expect(res.status).toBe(401);
  });
});
