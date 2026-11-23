import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  enregistrerClientCRM,
  fusionnerDonneesResto,
  gererAdmin,
  lireTokenSession,
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
});
