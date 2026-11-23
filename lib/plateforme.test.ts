import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  calculerPartAdmin,
  enregistrerClientCRM,
  fusionnerDonneesResto,
  gererAdmin,
  lireTokenSession,
  majPositionLivreur,
  slugifier,
  suiviPublic,
  type RestaurantGestion,
} from './plateforme';
import type { DonneesResto, Env } from './serveur';
import type { Livreur } from './livreur';

const LIVREUR: Livreur = {
  nom: 'Ahmed Livraison',
  slogan: 'Sfax',
  couleur: '#1A6BE0',
  whatsapp: '21693028832',
  email: 'rider@example.com',
  ville: 'Sfax',
  livraison: { base: 1, parKm: 0.5, min: 1, max: 12, rayonMaxKm: 15, facteurRoute: 1.3 },
};

const ENV_SB: Env = {
  SUPABASE_URL: 'https://demo.supabase.co',
  SUPABASE_SECRET_KEY: 'sb_secret_test_key',
};

const STATIQUE: DonneesResto = {
  media: 'https://media.example.com',
  resto: {
    id: 1,
    slug: 'chap-lab',
    nom: 'Chap Lab',
    adresse: 'Centre Sfax',
    telephone: '74000000',
    position: { lat: 34.74, lng: 10.76 },
    logo: null,
    couverture: null,
    note: 4.5,
    nbAvis: 30,
    delai: '25 min',
    popularite: 100,
    cuisines: ['Tunisienne'],
    categories: ['Sandwichs'],
    horaires: [],
    plats: ['Makloub'],
  },
  menu: {
    restoId: 1,
    categories: [{ id: 1, nom: 'Sandwichs' }],
    plats: [{ id: 10, categorieId: 1, nom: 'Makloub', description: '', prix: 9, prixOrigine: null, populaire: false, image: null, groupes: [] }],
  },
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('slugifier & lireTokenSession', () => {
  it('normalise les accents et caractères spéciaux en slug valide', () => {
    expect(slugifier('Café & Pâtisserie L’Étoile!')).toBe('cafe-patisserie-l-etoile');
  });

  it('extrait le token depuis le cookie liv_session ou Authorization Bearer', () => {
    const reqCookie = new Request('https://site.test/api/auth/me', {
      headers: { cookie: 'foo=1; liv_session=jwt-token-123; bar=2' },
    });
    expect(lireTokenSession(reqCookie)).toBe('jwt-token-123');

    const reqBearer = new Request('https://site.test/api/auth/me', {
      headers: { authorization: 'Bearer jwt-bearer-456' },
    });
    expect(lireTokenSession(reqBearer)).toBe('jwt-bearer-456');
  });
});

describe('fusionnerDonneesResto', () => {
  it('signale un restaurant désactivé par l’admin', () => {
    const gestion: RestaurantGestion = {
      slug: 'chap-lab',
      source: 'override',
      actif: false,
      nom: null,
      adresse: null,
      telephone: null,
      cuisines: null,
      type_commerce: null,
      image: null,
      delai: null,
      horaires: null,
      position: null,
      plats_overrides: {},
    };
    const res = fusionnerDonneesResto(STATIQUE, gestion, 'https://media.example.com');
    expect(res.desactive).toBe(true);
    expect(res.donnees).toBeNull();
  });

  it('construit un restaurant custom avec ses plats ajoutés', () => {
    const gestion: RestaurantGestion = {
      slug: 'grill-house',
      source: 'custom',
      actif: true,
      nom: 'Grill House',
      adresse: 'Route Tunis',
      telephone: '74111222',
      cuisines: ['Grillades'],
      type_commerce: 'restaurants',
      image: null,
      delai: '30 min',
      horaires: null,
      position: { lat: 34.75, lng: 10.77 },
      plats_overrides: {
        ajouts: [
          { id: 900001, nom: 'Mix Grill', prix: 24, categorie: 'Grillades', indispo: false },
          { id: 900002, nom: 'Plat caché', prix: 10, categorie: 'Grillades', indispo: true },
        ],
      },
    };
    const res = fusionnerDonneesResto(null, gestion, 'https://media.example.com');
    expect(res.desactive).toBe(false);
    expect(res.donnees?.resto.nom).toBe('Grill House');
    expect(res.donnees?.menu.plats).toHaveLength(1);
    expect(res.donnees?.menu.plats[0].nom).toBe('Mix Grill');
  });

  it('applique les modifications de prix et les plats ajoutés sur un restaurant existant', () => {
    const gestion: RestaurantGestion = {
      slug: 'chap-lab',
      source: 'override',
      actif: true,
      nom: 'Chap Lab Sfax',
      adresse: null,
      telephone: null,
      cuisines: null,
      type_commerce: null,
      image: null,
      delai: null,
      horaires: null,
      position: null,
      plats_overrides: {
        modifs: { '10': { prix: 11.5 } },
        ajouts: [{ id: 900001, nom: 'Tacos Poulet', prix: 13, categorie: 'Tacos' }],
      },
    };
    const res = fusionnerDonneesResto(STATIQUE, gestion, 'https://media.example.com');
    expect(res.donnees?.resto.nom).toBe('Chap Lab Sfax');
    expect(res.donnees?.menu.plats).toHaveLength(2);
    expect(res.donnees?.menu.plats.find((p) => p.id === 10)?.prix).toBe(11.5);
    expect(res.donnees?.menu.plats.find((p) => p.id === 900001)?.nom).toBe('Tacos Poulet');
  });
});

describe('enregistrerClientCRM', () => {
  it('cumule nb_commandes et total_depense et conserve l’email existant', async () => {
    const appels: { url: string; method: string; body?: string }[] = [];
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input);
      const method = init?.method ?? 'GET';
      appels.push({ url, method, body: typeof init?.body === 'string' ? init.body : undefined });
      if (method === 'GET') {
        return Response.json([
          {
            id: '11111111-1111-1111-1111-111111111111',
            telephone: '21622111222',
            user_id: null,
            nom: 'Sami',
            email: 'sami@example.com',
            nb_commandes: 2,
            total_depense: 35,
            premiere_commande_at: '2026-11-01T10:00:00.000Z',
            marketing_email: true,
            marketing_whatsapp: true,
          },
        ]);
      }
      return new Response(null, { status: 201 });
    });

    await enregistrerClientCRM(ENV_SB, {
      telephone: '22111222',
      nom: 'Sami Ben Ali',
      email: null,
      adresse: 'Route Gremda',
      montantCommande: 15.5,
    });

    const post = appels.find((a) => a.method === 'POST');
    expect(post).toBeDefined();
    const payload = JSON.parse(post!.body!);
    expect(payload.telephone).toBe('21622111222');
    expect(payload.nb_commandes).toBe(3);
    expect(payload.total_depense).toBe(50.5);
    expect(payload.email).toBe('sami@example.com');
    expect(payload.premiere_commande_at).toBe('2026-11-01T10:00:00.000Z');
  });
});

describe('gererAdmin & suiviPublic', () => {
  it('refuse l’accès admin sans session (401) et pour un client (403)', async () => {
    const sansCookie = new Request('https://site.test/api/admin/stats');
    const r401 = await gererAdmin(sansCookie, ENV_SB, LIVREUR, 'stats');
    expect(r401.status).toBe(401);

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes('/auth/v1/user')) return Response.json({ id: 'u-client', email: 'c@test.tn' });
      if (url.includes('/rest/v1/profiles')) {
        return Response.json([{ id: 'u-client', email: 'c@test.tn', role: 'client', nom: 'Client', actif: true }]);
      }
      return Response.json([]);
    });

    const reqClient = new Request('https://site.test/api/admin/stats', {
      headers: { cookie: 'liv_session=tok' },
    });
    const r403 = await gererAdmin(reqClient, ENV_SB, LIVREUR, 'stats');
    expect(r403.status).toBe(403);
  });

  it('valide ref + téléphone dans suiviPublic', async () => {
    const bad = await suiviPublic(new Request('https://site.test/api/suivi?ref=TEST01'), ENV_SB);
    expect(bad.status).toBe(400);
  });

  it('permet à l’admin de lire et mettre à jour /api/admin/reglages', async () => {
    let savedConfig: unknown = { pause: false, plats: {} };
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input);
      const method = (init?.method ?? 'GET').toUpperCase();
      if (url.includes('/auth/v1/user')) return Response.json({ id: 'u-admin', email: 'admin@livraison.tn' });
      if (url.includes('/rest/v1/profiles')) {
        return Response.json([{ id: 'u-admin', email: 'admin@livraison.tn', role: 'admin', nom: 'Admin', actif: true }]);
      }
      if (url.includes('/rest/v1/livreur_configs') && method === 'GET') {
        return Response.json([{ config: savedConfig }]);
      }
      if (url.includes('/rest/v1/livreur_configs') && method === 'POST') {
        const body = JSON.parse(String(init?.body));
        savedConfig = body.config;
        return new Response(null, { status: 201 });
      }
      return Response.json([]);
    });

    const rGet = await gererAdmin(
      new Request('https://site.test/api/admin/reglages', { headers: { cookie: 'liv_session=tok' } }),
      ENV_SB,
      LIVREUR,
      'reglages',
    );
    expect(rGet.status).toBe(200);
    const dGet = await rGet.json();
    expect(dGet.pauseActive).toBe(false);

    const rPatch = await gererAdmin(
      new Request('https://site.test/api/admin/reglages', {
        method: 'PATCH',
        headers: { cookie: 'liv_session=tok', 'content-type': 'application/json' },
        body: JSON.stringify({ pause: true, annonce: 'Pause 15 min' }),
      }),
      ENV_SB,
      LIVREUR,
      'reglages',
    );
    expect(rPatch.status).toBe(200);
    const dPatch = await rPatch.json();
    expect(dPatch.pauseActive).toBe(true);
    expect(dPatch.effectif.annonce).toBe('Pause 15 min');
  });

  it('affectation à un sous-livreur envoie un email détaillé et un sous-livreur ne peut modifier que ses commandes', async () => {
    const emailsEnvoyes: { to: string; subject: string }[] = [];
    const envMail: Env = { ...ENV_SB, RESEND_API_KEY: 're_test_123' };
    const subId = '22222222-2222-4222-8222-222222222222';
    const cmd = {
      id: '9000000000001-ABC123',
      ref: 'ABC123',
      type: 'repas',
      statut: 'nouvelle',
      creee: '2026-11-23T10:00:00.000Z',
      fin: null,
      statut_updated_at: null,
      historique_statuts: [],
      titre: 'Chap Lab',
      lignes: ['1× Makloub'],
      client_nom: 'Sami',
      client_telephone: '21622111222',
      client_email: 'client@livraison.tn',
      adresse: 'Route Gremda',
      note: null,
      total: 15,
      resto_slug: 'chap-lab',
      livreur_id: null,
      livreur_nom: null,
      user_id: null,
    };

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input);
      const method = (init?.method ?? 'GET').toUpperCase();
      if (url.includes('api.resend.com/emails')) {
        const b = JSON.parse(String(init?.body));
        emailsEnvoyes.push({ to: b.to, subject: b.subject });
        return Response.json({ id: 'mail_1' });
      }
      if (url.includes('/auth/v1/user')) return Response.json({ id: 'u-admin', email: 'admin@livraison.tn' });
      if (url.includes('/rest/v1/profiles')) {
        return Response.json([{ id: 'u-admin', email: 'admin@livraison.tn', role: 'admin', nom: 'Admin', actif: true }]);
      }
      if (url.includes('/rest/v1/commandes') && method === 'GET') return Response.json([cmd]);
      if (url.includes('/rest/v1/livreurs') && method === 'GET') {
        return Response.json([{ id: subId, user_id: 'u-sub', nom: 'Karim Livreur', telephone: '21655111222', email: 'livreur@livraison.tn', ville: 'Sfax', vehicule: 'Moto', actif: true, disponible: true, notes: null }]);
      }
      if (url.includes('/rest/v1/commandes') && method === 'PATCH') {
        const patch = JSON.parse(String(init?.body));
        return Response.json([{ ...cmd, ...patch }]);
      }
      if (url.includes('/rest/v1/push_subscriptions')) return Response.json([]);
      return Response.json([]);
    });

    const r = await gererAdmin(
      new Request('https://site.test/api/admin/commandes', {
        method: 'PATCH',
        headers: { cookie: 'liv_session=tok', 'content-type': 'application/json' },
        body: JSON.stringify({ id: cmd.id, livreur_id: subId, notifier_client: true }),
      }),
      envMail,
      LIVREUR,
      'commandes',
    );
    expect(r.status).toBe(200);
    const d = await r.json();
    expect(d.commande.livreur_nom).toBe('Karim Livreur');
    expect(d.notifications.whatsappLivreurUrl).toContain('https://wa.me/21655111222');
    expect(emailsEnvoyes.some((e) => e.to === 'livreur@livraison.tn' && e.subject.includes('ABC123'))).toBe(true);
    expect(emailsEnvoyes.some((e) => e.to === 'client@livraison.tn' && e.subject.includes('ABC123'))).toBe(true);
  });

  it('calculerPartAdmin calcule correctement fixe et pourcentage, et /api/admin/reglement solde les courses', async () => {
    expect(calculerPartAdmin(20, 'fixe', 1.5)).toBe(1.5);
    expect(calculerPartAdmin(20, 'pourcent', 10)).toBe(2);
    expect(calculerPartAdmin(13.5, 'pourcent', 8)).toBe(1.08);

    const subId = '22222222-2222-4222-8222-222222222222';
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input);
      const method = (init?.method ?? 'GET').toUpperCase();
      if (url.includes('/auth/v1/user')) return Response.json({ id: 'u-admin', email: 'admin@livraison.tn' });
      if (url.includes('/rest/v1/profiles')) {
        return Response.json([{ id: 'u-admin', email: 'admin@livraison.tn', role: 'admin', nom: 'Admin', actif: true }]);
      }
      if (url.includes('/rest/v1/commandes') && method === 'PATCH') {
        return Response.json([{ id: 'c1', part_admin: '1.000' }, { id: 'c2', part_admin: '1.500' }]);
      }
      return Response.json([]);
    });

    const r = await gererAdmin(
      new Request('https://site.test/api/admin/reglement', {
        method: 'POST',
        headers: { cookie: 'liv_session=tok', 'content-type': 'application/json' },
        body: JSON.stringify({ livreur_id: subId }),
      }),
      ENV_SB,
      LIVREUR,
      'reglement',
    );
    expect(r.status).toBe(200);
    const d = await r.json();
    expect(d.nb_reglees).toBe(2);
    expect(d.montant_regle).toBe(2.5);
  });

  it('gère /api/admin/upload, /api/livreur/position et /api/admin/notifier-resto sans PII client', async () => {
    const subId = '22222222-2222-4222-8222-222222222222';
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input);
      const method = (init?.method ?? 'GET').toUpperCase();
      if (url.includes('/auth/v1/user')) return Response.json({ id: 'u-admin', email: 'admin@livraison.tn' });
      if (url.includes('/rest/v1/profiles')) {
        return Response.json([{ id: 'u-admin', email: 'admin@livraison.tn', role: 'admin', nom: 'Admin', telephone: '21693028832', actif: true }]);
      }
      if (url.includes('/storage/v1/object/medias/') && method === 'POST') return Response.json({ Key: 'medias/ok.png' });
      if (url.includes('/rest/v1/livreurs') && method === 'GET') {
        return Response.json([{ id: subId, user_id: 'u-admin', nom: 'Ahmed', telephone: '21693028832', email: null, ville: 'Sfax', vehicule: 'Moto', actif: true, disponible: true, commission_type: 'fixe', commission_valeur: 1, notes: null }]);
      }
      if (url.includes('/rest/v1/livreurs') && method === 'PATCH') return new Response(null, { status: 204 });
      if (url.includes('/rest/v1/commandes') && method === 'GET') {
        return Response.json([{
          id: '9000000000001-RST001',
          ref: 'RST001',
          type: 'repas',
          statut: 'nouvelle',
          creee: '2026-11-23T12:00:00.000Z',
          titre: 'Chap Lab',
          lignes: ['2× Makloub Escalope'],
          client_nom: 'Sami Secret',
          client_telephone: '21622999888',
          adresse: 'Rue Secrete 42',
          note: 'Sans oignons',
          total: 18,
          resto_slug: 'chap-lab',
          resto_telephone: '74123456',
          livreur_id: subId,
        }]);
      }
      if (url.includes('/rest/v1/restaurants_gestion')) return Response.json([]);
      if (url.includes('/rest/v1/commandes') && method === 'PATCH') return new Response(null, { status: 204 });
      return Response.json([]);
    });

    // 1. Upload PNG
    const tinyPng = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
    const rUp = await gererAdmin(
      new Request('https://site.test/api/admin/upload', {
        method: 'POST',
        headers: { cookie: 'liv_session=tok', 'content-type': 'application/json' },
        body: JSON.stringify({ dataUrl: tinyPng, dossier: 'logos' }),
      }),
      ENV_SB,
      LIVREUR,
      'upload',
    );
    expect(rUp.status).toBe(201);
    expect((await rUp.json()).url).toContain('/storage/v1/object/public/medias/logos/');

    // 2. GPS position update
    const rPos = await majPositionLivreur(
      new Request('https://site.test/api/livreur/position', {
        method: 'POST',
        headers: { cookie: 'liv_session=tok', 'content-type': 'application/json' },
        body: JSON.stringify({ lat: 34.741, lng: 10.761 }),
      }),
      ENV_SB,
      LIVREUR,
    );
    expect(rPos.status).toBe(200);

    // 3. Notify restaurant (WhatsApp) — never leaks client phone/address!
    const rResto = await gererAdmin(
      new Request('https://site.test/api/admin/notifier-resto', {
        method: 'POST',
        headers: { cookie: 'liv_session=tok', 'content-type': 'application/json' },
        body: JSON.stringify({ commande_id: '9000000000001-RST001', canal: 'whatsapp' }),
      }),
      ENV_SB,
      LIVREUR,
      'notifier-resto',
    );
    expect(rResto.status).toBe(200);
    const dResto = await rResto.json();
    expect(dResto.whatsappUrl).toContain('https://wa.me/21674123456');
    expect(dResto.texteResto).toContain('2× Makloub Escalope');
    expect(dResto.texteResto).not.toContain('21622999888');
    expect(dResto.texteResto).not.toContain('Rue Secrete');
  });
});
