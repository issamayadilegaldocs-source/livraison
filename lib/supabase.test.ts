import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { signerBon } from './bon';
import { getMenu, getResto } from './catalogue';
import { getLivreur } from './livreur';
import { etatLivreur, pageCommandes, pageConfig, pagePush, recevoirBon, servirBon, traiterCommande, verifierCoupon, type DonneesResto, type Env } from './serveur';
import { headersSupabase, stockage, stockageSupabase } from './supabase';

const URL_SB = 'https://dgfumxhhfdbcihemztkq.supabase.co';
const CLE_SECRET = 'sb_secret_test_1234567890';
const CLE_LEGACY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test.sig';

type LigneCmd = {
  id: string;
  livreur_whatsapp: string;
  type: 'repas' | 'colis';
  ref: string;
  statut: 'nouvelle' | 'livree' | 'annulee';
  creee: string;
  fin: string | null;
  titre: string;
  lignes: string[];
  client_nom: string;
  client_telephone: string;
  adresse: string;
  note: string | null;
  total: string;
  html: string | null;
};

/** Simule PostgREST + Storage Supabase en mémoire pour tester les requêtes réelles de `lib/supabase.ts`. */
function fauxSupabase() {
  const configs = new Map<string, unknown>();
  const commandes = new Map<string, LigneCmd>();
  const usages = new Set<string>();
  const push = new Map<string, { livreur_whatsapp: string; endpoint: string; updated_at: string }>();
  const bons = new Map<string, Uint8Array>();
  const appels: { url: string; method: string; headers: Record<string, string> }[] = [];

  const eqParam = (u: URL, k: string) => {
    const v = u.searchParams.get(k);
    return v?.startsWith('eq.') ? v.slice(3) : null;
  };

  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const urlStr = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    const method = (init?.method ?? 'GET').toUpperCase();
    const hdrs = (init?.headers ?? {}) as Record<string, string>;
    appels.push({ url: urlStr, method, headers: hdrs });

    // Resend / autres appels externes
    if (!urlStr.startsWith(URL_SB)) return new Response('{"id":"x"}', { status: 200 });

    const u = new URL(urlStr);

    // Storage : /storage/v1/object/bons/<id>.png
    if (u.pathname.startsWith('/storage/v1/object/bons/')) {
      const nom = decodeURIComponent(u.pathname.slice('/storage/v1/object/bons/'.length));
      if (method === 'POST') {
        if (bons.has(nom)) return Response.json({ statusCode: '409', error: 'Duplicate', message: 'The resource already exists' }, { status: 409 });
        bons.set(nom, new Uint8Array(init?.body as Uint8Array));
        return Response.json({ Key: `bons/${nom}` }, { status: 200 });
      }
      if (method === 'GET') {
        const b = bons.get(nom);
        return b ? new Response(b as BodyInit, { status: 200, headers: { 'content-type': 'image/png' } }) : new Response('not found', { status: 404 });
      }
    }

    // PostgREST : /rest/v1/<table>
    const table = u.pathname.replace(/^\/rest\/v1\//, '');
    const body = typeof init?.body === 'string' ? JSON.parse(init.body) : null;

    if (table === 'livreur_configs') {
      if (method === 'GET') {
        const w = eqParam(u, 'livreur_whatsapp')!;
        return Response.json(configs.has(w) ? [{ config: configs.get(w) }] : []);
      }
      if (method === 'POST') {
        configs.set(body.livreur_whatsapp, body.config);
        return new Response(null, { status: 201 });
      }
    }

    if (table === 'commandes') {
      if (method === 'POST') {
        // PostgREST peut renvoyer `numeric` comme chaîne — on le reproduit ici.
        commandes.set(`${body.livreur_whatsapp}/${body.id}`, { ...body, total: String(body.total) });
        return new Response(null, { status: 201 });
      }
      if (method === 'GET') {
        const w = eqParam(u, 'livreur_whatsapp')!;
        const limit = Number(u.searchParams.get('limit') ?? 30);
        const rows = [...commandes.values()]
          .filter((r) => r.livreur_whatsapp === w)
          .sort((a, b) => b.creee.localeCompare(a.creee) || a.id.localeCompare(b.id))
          .slice(0, limit);
        return Response.json(rows);
      }
      if (method === 'PATCH') {
        const w = eqParam(u, 'livreur_whatsapp')!;
        const id = eqParam(u, 'id')!;
        const k = `${w}/${id}`;
        const cur = commandes.get(k);
        if (!cur) return Response.json([]);
        commandes.set(k, { ...cur, ...body });
        return Response.json([{ id }]);
      }
    }

    if (table === 'coupon_usages') {
      if (method === 'POST') {
        usages.add(`${body.livreur_whatsapp}|${body.code}|${body.commande_ref}`);
        return new Response(null, { status: 201 });
      }
      if (method === 'GET') {
        const w = eqParam(u, 'livreur_whatsapp')!;
        const code = eqParam(u, 'code')!;
        const limit = Number(u.searchParams.get('limit') ?? 100);
        const rows = [...usages]
          .filter((k) => k.startsWith(`${w}|${code}|`))
          .slice(0, limit)
          .map((k) => ({ commande_ref: k.split('|')[2] }));
        return Response.json(rows);
      }
    }

    if (table === 'push_subscriptions') {
      if (method === 'POST') {
        push.set(`${body.livreur_whatsapp}|${body.endpoint}`, {
          livreur_whatsapp: body.livreur_whatsapp,
          endpoint: body.endpoint,
          updated_at: body.updated_at,
        });
        return new Response(null, { status: 201 });
      }
      if (method === 'GET') {
        const w = eqParam(u, 'livreur_whatsapp')!;
        const desc = u.searchParams.get('order') === 'updated_at.desc';
        const rows = [...push.values()]
          .filter((r) => r.livreur_whatsapp === w)
          .sort((a, b) => (desc ? b.updated_at.localeCompare(a.updated_at) : a.updated_at.localeCompare(b.updated_at)))
          .map((r) => ({ endpoint: r.endpoint }));
        return Response.json(rows);
      }
      if (method === 'DELETE') {
        const w = eqParam(u, 'livreur_whatsapp')!;
        const ep = eqParam(u, 'endpoint')!;
        push.delete(`${w}|${ep}`);
        return new Response(null, { status: 204 });
      }
    }

    return new Response('Unhandled mock route', { status: 404 });
  });

  return { fetchMock, appels, configs, commandes, usages, push, bons };
}

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-16T12:00:00+01:00'));
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('headersSupabase et résolution du stockage', () => {
  it('envoie uniquement apikey pour les nouvelles clés sb_secret_… (pas Authorization)', () => {
    const h = headersSupabase(CLE_SECRET, { Accept: 'application/json' });
    expect(h).toEqual({ apikey: CLE_SECRET, Accept: 'application/json' });
    expect(h.Authorization).toBeUndefined();
  });

  it('envoie apikey + Authorization Bearer pour une ancienne clé JWT service_role', () => {
    const h = headersSupabase(CLE_LEGACY);
    expect(h).toEqual({ apikey: CLE_LEGACY, Authorization: `Bearer ${CLE_LEGACY}` });
  });

  it('choisit Supabase dès que URL + clé secrète sont présents, sinon null sans R2', () => {
    expect(stockage({ SUPABASE_URL: URL_SB, SUPABASE_SECRET_KEY: CLE_SECRET })).not.toBeNull();
    expect(stockage({ NEXT_PUBLIC_SUPABASE_URL: URL_SB, SUPABASE_SERVICE_ROLE_KEY: CLE_LEGACY })).not.toBeNull();
    // URL seule sans clé secrète : jamais de connexion avec la clé publique
    expect(stockage({ NEXT_PUBLIC_SUPABASE_URL: URL_SB })).toBeNull();
    expect(stockage({})).toBeNull();
  });
});

describe('stockageSupabase (PostgREST + Storage)', () => {
  it('gère les abonnements push en gardant les 5 plus récents et en supprimant les expirés', async () => {
    const sb = fauxSupabase();
    vi.stubGlobal('fetch', sb.fetchMock);
    const s = stockageSupabase(URL_SB, CLE_SECRET);

    for (let i = 1; i <= 6; i++) {
      vi.setSystemTime(new Date(`2026-11-16T12:0${i}:00+01:00`));
      await s.ajouterAbonnementPush('21600000000', `https://fcm.googleapis.com/fcm/send/dev-${i}`, 5);
    }

    const actifs = await s.lireAbonnementsPush('21600000000');
    expect(actifs).toHaveLength(5);
    expect(actifs).not.toContain('https://fcm.googleapis.com/fcm/send/dev-1');
    expect(actifs[4]).toBe('https://fcm.googleapis.com/fcm/send/dev-6');

    await s.retirerAbonnementsPush('21600000000', ['https://fcm.googleapis.com/fcm/send/dev-2']);
    expect(await s.lireAbonnementsPush('21600000000')).toHaveLength(4);
  });

  it('enregistrerBon accepte les doublons 409 et 400 legacy sans écraser le premier bon', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(new Response(JSON.stringify({ error: 'Duplicate', statusCode: '409' }), { status: 400 }))
        .mockResolvedValueOnce(new Response(null, { status: 409 })),
    );
    const s = stockageSupabase(URL_SB, CLE_SECRET);
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1]);
    await expect(s.enregistrerBon('ABC123-0123456789abcdef0123456789abcdef', png)).resolves.toBeUndefined();
    await expect(s.enregistrerBon('ABC123-0123456789abcdef0123456789abcdef', png)).resolves.toBeUndefined();
  });

  it('parcours complet Pages Functions via Supabase (sans bucket R2)', async () => {
    const sb = fauxSupabase();
    vi.stubGlobal('fetch', sb.fetchMock);

    const env: Env = {
      SUPABASE_URL: URL_SB,
      SUPABASE_SECRET_KEY: CLE_SECRET,
      RESEND_API_KEY: 're_test',
      BON_SECRET: 'secret-test',
      CONFIG_CLE: 'cle-config-test',
    };
    const livreur = getLivreur();
    const resto = getResto('baguette-baguette')!;
    const plat = getMenu(resto.id)!.plats.find((p) => p.groupes.every((g) => !g.obligatoire))!;
    const lire = async (slug: string): Promise<DonneesResto | null> => {
      const r = getResto(slug);
      return r ? { resto: r, menu: getMenu(r.id)!, media: '/media' } : null;
    };

    // 1. Config : ajouter un coupon limité à 1 usage via /api/config
    const formCoupon = new URLSearchParams({
      cle: 'cle-config-test',
      action: 'coupon-ajouter',
      code: 'PROMO1',
      type: 'montant',
      valeur: '2',
      limite: '1',
      financeur: 'livreur',
    });
    const resConf = await pageConfig(
      new Request('https://speedy.test/api/config', { method: 'POST', body: formCoupon.toString() }),
      env,
      livreur,
      lire,
      async () => [{ slug: resto.slug, nom: resto.nom }],
    );
    expect(resConf.status).toBe(303);

    // 2. /api/etat et /api/coupon lisent la config depuis Supabase
    const resEtat = await etatLivreur(new Request('https://speedy.test/api/etat'), env, livreur);
    expect(resEtat.status).toBe(200);
    const resCoupon = await verifierCoupon(
      new Request('https://speedy.test/api/coupon', { method: 'POST', body: JSON.stringify({ code: 'PROMO1', resto: resto.slug }) }),
      env,
      livreur,
    );
    expect(resCoupon.status).toBe(200);

    // 3. /api/commande enregistre la fiche + l'usage du coupon + prépare le bon
    const resCmd = await traiterCommande(
      new Request('https://speedy.test/api/commande', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          restoSlug: resto.slug,
          lignes: [{ platId: plat.id, qte: 1, choix: {} }],
          client: { nom: 'Sami', telephone: '22123456', adresse: '3 rue de Rome' },
          position: { lat: resto.position.lat + 2 / 111.195, lng: resto.position.lng },
          code: 'PROMO1',
        }),
      }),
      env,
      livreur,
      lire,
    );
    expect(resCmd.status).toBe(200);
    const cmdJson = await resCmd.json();
    expect(cmdJson.bon).not.toBeNull();
    expect(sb.commandes.size).toBe(1);
    expect(sb.usages.size).toBe(1);

    // Le coupon limité à 1 usage est maintenant refusé
    const resCoupon2 = await verifierCoupon(
      new Request('https://speedy.test/api/coupon', { method: 'POST', body: JSON.stringify({ code: 'PROMO1', resto: resto.slug }) }),
      env,
      livreur,
    );
    expect(resCoupon2.status).toBe(404);

    // 4. /api/bon/<id> : upload vers Supabase Storage puis lecture (et pas d'écrasement au 2e envoi)
    const png1 = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
    const png2 = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 9, 9, 9]);
    const sig = await signerBon(cmdJson.bon.id, 'secret-test');
    expect((await recevoirBon(new Request(`https://speedy.test/api/bon/${cmdJson.bon.id}?sig=${sig}`, { method: 'POST', body: png1 }), env, cmdJson.bon.id)).status).toBe(200);
    expect((await recevoirBon(new Request(`https://speedy.test/api/bon/${cmdJson.bon.id}?sig=${sig}`, { method: 'POST', body: png2 }), env, cmdJson.bon.id)).status).toBe(200);
    const resBon = await servirBon(env, cmdJson.bon.id);
    expect(resBon.status).toBe(200);
    expect(new Uint8Array(await resBon.arrayBuffer())).toEqual(png1);

    // 5. /api/commandes : GET affiche la commande, POST la marque livrée
    const htmlCmds = await (await pageCommandes(new Request('https://speedy.test/api/commandes?cle=cle-config-test'), env, livreur)).text();
    expect(htmlCmds).toContain(cmdJson.ref);
    const [saved] = [...sb.commandes.values()];
    const resMaj = await pageCommandes(
      new Request('https://speedy.test/api/commandes?cle=cle-config-test', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id: saved.id, statut: 'livree' }),
      }),
      env,
      livreur,
    );
    expect(resMaj.status).toBe(200);
    expect(sb.commandes.get(`${livreur.whatsapp}/${saved.id}`)?.statut).toBe('livree');

    // 6. /api/push : enregistre l'appareil dans Supabase
    const resPush = await pagePush(
      new Request('https://speedy.test/api/push?cle=cle-config-test', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ endpoint: 'https://fcm.googleapis.com/fcm/send/abc' }),
      }),
      env,
      livreur,
    );
    expect(resPush.status).toBe(200);
    expect(sb.push.size).toBe(1);

    // Vérifie qu'aucun appel Supabase n'a envoyé Authorization avec une clé sb_secret_…
    const appelsSb = sb.appels.filter((a) => a.url.startsWith(URL_SB));
    expect(appelsSb.length).toBeGreaterThan(5);
    for (const a of appelsSb) {
      expect(a.headers.apikey).toBe(CLE_SECRET);
      expect(a.headers.Authorization).toBeUndefined();
    }
  });
});
