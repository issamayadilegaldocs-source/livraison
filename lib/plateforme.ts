// Plateforme : authentification (Supabase Auth), comptes clients, suivi des commandes,
// CRM clients cumulatif, notifications (email + WhatsApp), gestion des livreurs et des restaurants.
// Pur Web Standards (`fetch`, aucun module Node) : tourne sur Vercel Functions et dans vitest.
import { z } from 'zod';
import { envoyerEmail } from './email';
import { normaliserTelephone } from './commande';
import { ConfigSchema, pauseEnCours, reglages } from './config';
import type { Livreur } from './livreur';
import { headersSupabase, stockage, type EnvStockage } from './supabase';
import { alerterPushTelephone, type DonneesResto, type Env } from './serveur';
import type { Horaire, Plat } from './catalogue';

export type Role = 'client' | 'livreur' | 'admin';

export const STATUTS_COMMANDE = ['nouvelle', 'confirmee', 'en_preparation', 'en_livraison', 'livree', 'annulee'] as const;
export type StatutCommande = (typeof STATUTS_COMMANDE)[number];

export const LIBELLES_STATUT: Record<StatutCommande, string> = {
  nouvelle: 'Commande reçue',
  confirmee: 'Confirmée',
  en_preparation: 'En préparation',
  en_livraison: 'En livraison',
  livree: 'Livrée',
  annulee: 'Annulée',
};

export type ProfilUtilisateur = {
  id: string;
  email: string;
  role: Role;
  nom: string;
  telephone: string | null;
  adresse: string | null;
  position: { lat: number; lng: number; label?: string } | null;
  marketing_opt_in: boolean;
  actif: boolean;
  created_at?: string;
};

export type ClientCRM = {
  id: string;
  telephone: string;
  user_id: string | null;
  nom: string;
  email: string | null;
  derniere_adresse: string | null;
  derniere_position: { lat: number; lng: number; label?: string } | null;
  nb_commandes: number;
  total_depense: number;
  premiere_commande_at: string | null;
  derniere_commande_at: string | null;
  marketing_email: boolean;
  marketing_whatsapp: boolean;
  notes_admin: string | null;
  tags: string[];
  created_at?: string;
  updated_at?: string;
};

export type LivreurGestion = {
  id: string;
  user_id: string | null;
  nom: string;
  telephone: string;
  email: string | null;
  ville: string;
  vehicule: string | null;
  actif: boolean;
  disponible: boolean;
  commission_type: 'fixe' | 'pourcent';
  commission_valeur: number;
  last_lat?: number | null;
  last_lng?: number | null;
  last_seen_at?: string | null;
  notes: string | null;
  created_at?: string;
};

export type BilanLivreur = {
  livreur_id: string;
  nb_livrees_total: number;
  nb_livrees_aujourdhui: number;
  nb_non_reglees: number;
  ca_total: number;
  a_recuperer: number;
  deja_recupere: number;
};

export type PlatOverride = {
  nom?: string;
  prix?: number;
  description?: string;
  categorie?: string;
  indispo?: boolean;
};

export type PlatCustom = {
  id: number;
  nom: string;
  prix: number;
  description?: string;
  categorie: string;
  image?: string | null;
  indispo?: boolean;
};

export type PlatsOverridesDoc = {
  modifs?: Record<string, PlatOverride>;
  ajouts?: PlatCustom[];
};

export type RestaurantGestion = {
  slug: string;
  source: 'override' | 'custom';
  actif: boolean;
  nom: string | null;
  adresse: string | null;
  telephone: string | null;
  email?: string | null;
  cuisines: string[] | null;
  type_commerce: string | null;
  image: string | null;
  delai: string | null;
  horaires: Horaire[] | null;
  position: { lat: number; lng: number } | null;
  plats_overrides: PlatsOverridesDoc;
  updated_at?: string;
};

export type CommandeSuivi = {
  id: string;
  ref: string;
  type: 'repas' | 'colis';
  statut: StatutCommande;
  creee: string;
  fin: string | null;
  statut_updated_at: string | null;
  historique_statuts: { statut: StatutCommande; at: string }[];
  titre: string;
  lignes: string[];
  client_nom: string;
  client_telephone: string;
  client_email: string | null;
  adresse: string;
  note: string | null;
  total: number;
  resto_slug: string | null;
  livreur_id: string | null;
  livreur_nom: string | null;
  user_id: string | null;
  part_admin?: number;
  regle_admin?: boolean;
  regle_admin_at?: string | null;
  resto_telephone?: string | null;
  resto_notifie_at?: string | null;
  livreur_position?: { lat: number; lng: number; at: string } | null;
};

/** Calcule la part qui revient au livreur Admin sur une commande livrée par un sous-livreur. */
export function calculerPartAdmin(totalCommande: number, type: 'fixe' | 'pourcent', valeur: number): number {
  const v = Math.max(0, Number(valeur) || 0);
  if (type === 'pourcent') {
    return Math.round(Math.max(0, Number(totalCommande) || 0) * (Math.min(100, v) / 100) * 1000) / 1000;
  }
  return Math.round(v * 1000) / 1000;
}

const COOKIE_SESSION = 'liv_session';
const enc = encodeURIComponent;
const SLUG_RE = /^[a-z0-9-]{1,120}$/;

const json = (data: unknown, status = 200, extraHeaders: Record<string, string> = {}) =>
  Response.json(data, { status, headers: { 'cache-control': 'no-store', ...extraHeaders } });

const err = (status: number, erreur: string) => json({ erreur }, status);

function configSupabase(env: EnvStockage): { url: string; cle: string } | null {
  const url = (env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL || '').trim().replace(/\/+$/, '');
  const cle = (env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  return url && cle ? { url, cle } : null;
}

function authAdminHeaders(cle: string): Record<string, string> {
  return { apikey: cle, Authorization: `Bearer ${cle}`, 'Content-Type': 'application/json' };
}

function restFetch(sb: { url: string; cle: string }, chemin: string, init: RequestInit = {}, extra: Record<string, string> = {}) {
  return fetch(`${sb.url}/rest/v1/${chemin}`, {
    ...init,
    headers: headersSupabase(sb.cle, { Accept: 'application/json', ...extra }),
  });
}

/** Extrait le JWT d'accès depuis le cookie HttpOnly `liv_session` ou l'en-tête `Authorization: Bearer …`. */
export function lireTokenSession(req: Request): string | null {
  const auth = req.headers.get('authorization') ?? '';
  if (auth.toLowerCase().startsWith('bearer ')) {
    const t = auth.slice(7).trim();
    if (t) return t;
  }
  const cookie = req.headers.get('cookie') ?? '';
  for (const part of cookie.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    if (part.slice(0, idx).trim() === COOKIE_SESSION) {
      const val = decodeURIComponent(part.slice(idx + 1).trim());
      if (val) return val;
    }
  }
  return null;
}

function cookieSessionHeader(req: Request, token: string | null): string {
  const secure = new URL(req.url).protocol === 'https:' ? '; Secure' : '';
  if (!token) return `${COOKIE_SESSION}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`;
  return `${COOKIE_SESSION}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800${secure}`;
}

/** Vérifie le token auprès de Supabase Auth et lit le profil serveur (`public.profiles`, jamais `user_metadata`). */
export async function verifierUtilisateur(env: EnvStockage, req: Request): Promise<ProfilUtilisateur | null> {
  const sb = configSupabase(env);
  const token = lireTokenSession(req);
  if (!sb || !token) return null;

  const userRes = await fetch(`${sb.url}/auth/v1/user`, {
    headers: { apikey: sb.cle, Authorization: `Bearer ${token}` },
  }).catch(() => null);
  if (!userRes || !userRes.ok) return null;
  const user = (await userRes.json().catch(() => null)) as { id?: string; email?: string; app_metadata?: { role?: string } } | null;
  if (!user?.id || !user.email) return null;

  const profRes = await restFetch(sb, `profiles?id=eq.${enc(user.id)}&select=*&limit=1`);
  if (!profRes.ok) return null;
  const rows = (await profRes.json().catch(() => [])) as ProfilUtilisateur[];
  if (rows[0]) return rows[0].actif ? rows[0] : null;

  // Profil manquant : création automatique avec le rôle fiable de app_metadata (ou 'client').
  const role: Role = user.app_metadata?.role === 'admin' ? 'admin' : user.app_metadata?.role === 'livreur' ? 'livreur' : 'client';
  const nouveau: ProfilUtilisateur = {
    id: user.id,
    email: user.email.toLowerCase(),
    role,
    nom: '',
    telephone: null,
    adresse: null,
    position: null,
    marketing_opt_in: true,
    actif: true,
  };
  await restFetch(
    sb,
    'profiles?on_conflict=id',
    { method: 'POST', body: JSON.stringify(nouveau) },
    { 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
  ).catch(() => {});
  return nouveau;
}

export function slugifier(texte: string): string {
  return texte
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

/**
 * Cumule automatiquement les informations client dans `clients_crm` à chaque commande ou inscription.
 * Ne lève jamais d'erreur pour ne jamais bloquer une commande.
 */
export async function enregistrerClientCRM(
  env: EnvStockage,
  data: {
    telephone: string;
    nom: string;
    email?: string | null;
    adresse?: string | null;
    position?: { lat: number; lng: number; label?: string } | null;
    montantCommande?: number;
    userId?: string | null;
    marketingOptIn?: boolean;
    maintenant?: Date;
  },
): Promise<void> {
  const sb = configSupabase(env);
  if (!sb) return;
  const tel = normaliserTelephone(data.telephone);
  if (!tel) return;
  const iso = (data.maintenant ?? new Date()).toISOString();
  try {
    const getRes = await restFetch(sb, `clients_crm?telephone=eq.${enc(tel)}&select=*&limit=1`);
    const existants = getRes.ok ? ((await getRes.json().catch(() => [])) as ClientCRM[]) : [];
    const ex = existants[0];
    const estCommande = typeof data.montantCommande === 'number';
    const nb = (ex?.nb_commandes ?? 0) + (estCommande ? 1 : 0);
    const total = Number(((Number(ex?.total_depense ?? 0) + (estCommande ? data.montantCommande! : 0))).toFixed(3));
    const payload = {
      telephone: tel,
      user_id: data.userId ?? ex?.user_id ?? null,
      nom: data.nom.trim() || ex?.nom || 'Client',
      email: (data.email?.trim().toLowerCase() || ex?.email || null),
      derniere_adresse: data.adresse?.trim() || ex?.derniere_adresse || null,
      derniere_position: data.position ?? ex?.derniere_position ?? null,
      nb_commandes: nb,
      total_depense: total,
      premiere_commande_at: ex?.premiere_commande_at ?? (estCommande ? iso : null),
      derniere_commande_at: estCommande ? iso : (ex?.derniere_commande_at ?? null),
      marketing_email: data.marketingOptIn ?? ex?.marketing_email ?? true,
      marketing_whatsapp: data.marketingOptIn ?? ex?.marketing_whatsapp ?? true,
      updated_at: iso,
    };
    const up = await restFetch(
      sb,
      'clients_crm?on_conflict=telephone',
      { method: 'POST', body: JSON.stringify(payload) },
      { 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
    );
    if (!up.ok) console.error('[crm] upsert', up.status);
  } catch (e) {
    console.error('[crm] erreur', e instanceof Error ? e.message : e);
  }
}

/** Enrichit la ligne de `commandes` avec user_id, email, resto_slug, resto_telephone et l'historique initial des statuts. */
export async function enrichirCommandeMeta(
  env: EnvStockage,
  whatsapp: string,
  id: string,
  meta: { userId?: string | null; clientEmail?: string | null; restoSlug?: string | null; restoTelephone?: string | null; restoNotifieAt?: string | null; maintenant: Date },
): Promise<void> {
  const sb = configSupabase(env);
  if (!sb) return;
  const iso = meta.maintenant.toISOString();
  await restFetch(
    sb,
    `commandes?livreur_whatsapp=eq.${enc(whatsapp)}&id=eq.${enc(id)}`,
    {
      method: 'PATCH',
      body: JSON.stringify({
        ...(meta.userId ? { user_id: meta.userId } : {}),
        ...(meta.clientEmail ? { client_email: meta.clientEmail.trim().toLowerCase() } : {}),
        ...(meta.restoSlug ? { resto_slug: meta.restoSlug } : {}),
        ...(meta.restoTelephone ? { resto_telephone: meta.restoTelephone } : {}),
        ...(meta.restoNotifieAt ? { resto_notifie_at: meta.restoNotifieAt } : {}),
        statut_updated_at: iso,
        historique_statuts: [{ statut: 'nouvelle', at: iso }],
      }),
    },
    { 'Content-Type': 'application/json', Prefer: 'return=minimal' },
  ).catch(() => {});
}

// =============================================================================
// AUTHENTIFICATION & COMPTE CLIENT
// =============================================================================

const InscriptionSchema = z.object({
  email: z.string().trim().email('Adresse email invalide.').max(160),
  password: z.string().min(6, 'Le mot de passe doit contenir au moins 6 caractères.').max(100),
  nom: z.string().trim().min(2, 'Indiquez votre nom.').max(80),
  telephone: z.string().trim().min(8, 'Numéro de téléphone invalide.').max(30),
  adresse: z.string().trim().max(240).optional(),
  marketing_opt_in: z.boolean().optional(),
});

const ConnexionSchema = z.object({
  email: z.string().trim().email('Adresse email invalide.').max(160),
  password: z.string().min(1, 'Mot de passe requis.').max(100),
});

const ProfilMajSchema = z.object({
  nom: z.string().trim().min(2).max(80).optional(),
  telephone: z.string().trim().max(30).optional(),
  adresse: z.string().trim().max(240).optional(),
  marketing_opt_in: z.boolean().optional(),
});

export async function gererAuth(req: Request, env: Env, action: string): Promise<Response> {
  const sb = configSupabase(env);
  if (!sb) return err(503, 'Service comptes indisponible (Supabase non configuré).');

  if (action === 'me' && req.method === 'GET') {
    const profile = await verifierUtilisateur(env, req);
    return json({ user: profile });
  }

  if (action === 'logout' && req.method === 'POST') {
    return json({ ok: true }, 200, { 'Set-Cookie': cookieSessionHeader(req, null) });
  }

  if (action === 'register' && req.method === 'POST') {
    const body = await req.json().catch(() => null);
    const parsed = InscriptionSchema.safeParse(body);
    if (!parsed.success) return err(400, parsed.error.issues[0]?.message ?? 'Données invalides.');
    const tel = normaliserTelephone(parsed.data.telephone);
    if (!tel) return err(400, 'Numéro tunisien invalide (8 chiffres).');
    const email = parsed.data.email.toLowerCase();

    // Création immédiate via Admin API (email_confirm: true, rôle forcé 'client')
    const creRes = await fetch(`${sb.url}/auth/v1/admin/users`, {
      method: 'POST',
      headers: authAdminHeaders(sb.cle),
      body: JSON.stringify({
        email,
        password: parsed.data.password,
        email_confirm: true,
        app_metadata: { role: 'client' },
        user_metadata: { nom: parsed.data.nom },
      }),
    });
    if (!creRes.ok) {
      const txt = await creRes.text().catch(() => '');
      if (/already|registered|exists|duplicate/i.test(txt)) return err(409, 'Un compte existe déjà avec cet email.');
      return err(400, 'Impossible de créer le compte.');
    }
    const created = (await creRes.json()) as { id: string };

    const profile: ProfilUtilisateur = {
      id: created.id,
      email,
      role: 'client',
      nom: parsed.data.nom,
      telephone: tel,
      adresse: parsed.data.adresse || null,
      position: null,
      marketing_opt_in: parsed.data.marketing_opt_in ?? true,
      actif: true,
    };
    await restFetch(
      sb,
      'profiles?on_conflict=id',
      { method: 'POST', body: JSON.stringify({ ...profile, updated_at: new Date().toISOString() }) },
      { 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
    );

    // Enregistrer aussi dans clients_crm + rattacher les commandes déjà passées avec ce numéro
    await enregistrerClientCRM(env, {
      telephone: tel,
      nom: parsed.data.nom,
      email,
      adresse: parsed.data.adresse,
      userId: created.id,
      marketingOptIn: profile.marketing_opt_in,
    });
    await restFetch(
      sb,
      `commandes?client_telephone=eq.${enc(tel)}&user_id=is.null`,
      { method: 'PATCH', body: JSON.stringify({ user_id: created.id, client_email: email }) },
      { 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    ).catch(() => {});

    // Connexion immédiate pour obtenir un access_token
    const loginRes = await fetch(`${sb.url}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: authAdminHeaders(sb.cle),
      body: JSON.stringify({ email, password: parsed.data.password }),
    });
    if (!loginRes.ok) return json({ user: profile }, 201);
    const session = (await loginRes.json()) as { access_token?: string };
    return json({ user: profile }, 201, session.access_token ? { 'Set-Cookie': cookieSessionHeader(req, session.access_token) } : {});
  }

  if (action === 'login' && req.method === 'POST') {
    const body = await req.json().catch(() => null);
    const parsed = ConnexionSchema.safeParse(body);
    if (!parsed.success) return err(400, parsed.error.issues[0]?.message ?? 'Email ou mot de passe invalide.');
    const email = parsed.data.email.toLowerCase();

    const loginRes = await fetch(`${sb.url}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: authAdminHeaders(sb.cle),
      body: JSON.stringify({ email, password: parsed.data.password }),
    });
    if (!loginRes.ok) return err(401, 'Email ou mot de passe incorrect.');
    const session = (await loginRes.json()) as { access_token?: string; user?: { id: string; email?: string; app_metadata?: { role?: string } } };
    if (!session.access_token || !session.user?.id) return err(401, 'Connexion impossible.');

    const profRes = await restFetch(sb, `profiles?id=eq.${enc(session.user.id)}&select=*&limit=1`);
    const rows = profRes.ok ? ((await profRes.json().catch(() => [])) as ProfilUtilisateur[]) : [];
    let profile = rows[0];
    if (!profile) {
      const role: Role = session.user.app_metadata?.role === 'admin' ? 'admin' : session.user.app_metadata?.role === 'livreur' ? 'livreur' : 'client';
      profile = {
        id: session.user.id,
        email,
        role,
        nom: '',
        telephone: null,
        adresse: null,
        position: null,
        marketing_opt_in: true,
        actif: true,
      };
      await restFetch(
        sb,
        'profiles?on_conflict=id',
        { method: 'POST', body: JSON.stringify(profile) },
        { 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
      ).catch(() => {});
    }
    if (!profile.actif) return err(403, 'Ce compte est désactivé.');
    return json({ user: profile }, 200, { 'Set-Cookie': cookieSessionHeader(req, session.access_token) });
  }

  return err(404, 'Route auth introuvable.');
}

/** Routes `/api/compte/profil` et `/api/compte/commandes` pour le client connecté. */
export async function gererCompte(req: Request, env: Env, action: string): Promise<Response> {
  const sb = configSupabase(env);
  if (!sb) return err(503, 'Stockage indisponible.');
  const user = await verifierUtilisateur(env, req);
  if (!user) return err(401, 'Connectez-vous pour accéder à votre compte.');

  if (action === 'profil') {
    if (req.method === 'GET') return json({ profile: user });
    if (req.method === 'PATCH') {
      const body = await req.json().catch(() => null);
      const parsed = ProfilMajSchema.safeParse(body);
      if (!parsed.success) return err(400, 'Informations invalides.');
      const tel = parsed.data.telephone ? normaliserTelephone(parsed.data.telephone) : user.telephone;
      if (parsed.data.telephone && !tel) return err(400, 'Numéro tunisien invalide.');
      const patch = {
        ...(parsed.data.nom !== undefined ? { nom: parsed.data.nom } : {}),
        ...(parsed.data.telephone !== undefined ? { telephone: tel } : {}),
        ...(parsed.data.adresse !== undefined ? { adresse: parsed.data.adresse || null } : {}),
        ...(parsed.data.marketing_opt_in !== undefined ? { marketing_opt_in: parsed.data.marketing_opt_in } : {}),
        updated_at: new Date().toISOString(),
      };
      const res = await restFetch(
        sb,
        `profiles?id=eq.${enc(user.id)}&select=*`,
        { method: 'PATCH', body: JSON.stringify(patch) },
        { 'Content-Type': 'application/json', Prefer: 'return=representation' },
      );
      if (!res.ok) return err(500, 'Impossible de mettre à jour le profil.');
      const [maj] = (await res.json()) as ProfilUtilisateur[];
      if (maj?.telephone) {
        await enregistrerClientCRM(env, {
          telephone: maj.telephone,
          nom: maj.nom,
          email: maj.email,
          adresse: maj.adresse,
          userId: maj.id,
          marketingOptIn: maj.marketing_opt_in,
        });
      }
      return json({ profile: maj });
    }
  }

  if (action === 'commandes' && req.method === 'GET') {
    const filtres = user.telephone
      ? `or=(user_id.eq.${enc(user.id)},client_telephone.eq.${enc(user.telephone)})`
      : `user_id=eq.${enc(user.id)}`;
    const res = await restFetch(
      sb,
      `commandes?${filtres}&select=id,ref,type,statut,creee,fin,statut_updated_at,historique_statuts,titre,lignes,client_nom,client_telephone,client_email,adresse,note,total,resto_slug,livreur_id,livreur_nom,user_id&order=creee.desc&limit=50`,
    );
    if (!res.ok) return err(500, 'Impossible de charger vos commandes.');
    const commandes = await attacherPositionsLivreurs(sb, (await res.json()) as CommandeSuivi[]);
    return json({ commandes });
  }

  return err(404, 'Route compte introuvable.');
}

/** Ajoute `livreur_position` (GPS en direct, < 30 min) uniquement pour les commandes actives en cours. */
async function attacherPositionsLivreurs<T extends { statut?: string; livreur_id?: string | null; livreur_position?: { lat: number; lng: number; at: string } | null }>(
  sb: { url: string; cle: string },
  commandes: T[],
): Promise<T[]> {
  const ids = Array.from(
    new Set(
      commandes
        .filter((c) => c.livreur_id && c.statut && c.statut !== 'livree' && c.statut !== 'annulee')
        .map((c) => c.livreur_id!),
    ),
  );
  if (!ids.length) return commandes;
  const inList = ids.map((id) => `"${id}"`).join(',');
  const r = await restFetch(sb, `livreurs?id=in.(${inList})&select=id,last_lat,last_lng,last_seen_at`).catch(() => null);
  if (!r || !r.ok) return commandes;
  const rows = (await r.json().catch(() => [])) as { id: string; last_lat: number | null; last_lng: number | null; last_seen_at: string | null }[];
  const limiteMs = Date.now() - 30 * 60_000;
  const parId = new Map<string, { lat: number; lng: number; at: string }>();
  for (const row of rows) {
    if (typeof row.last_lat === 'number' && typeof row.last_lng === 'number' && row.last_seen_at && new Date(row.last_seen_at).getTime() >= limiteMs) {
      parId.set(row.id, { lat: row.last_lat, lng: row.last_lng, at: row.last_seen_at });
    }
  }
  return commandes.map((c) => ({
    ...c,
    livreur_position: c.livreur_id && c.statut !== 'livree' && c.statut !== 'annulee' ? (parId.get(c.livreur_id) ?? null) : null,
  }));
}

/** POST /api/livreur/position : met à jour la position GPS temps réel du livreur / sous-livreur connecté. */
export async function majPositionLivreur(req: Request, env: Env, livreurDefaut: Livreur): Promise<Response> {
  const sb = configSupabase(env);
  if (!sb) return err(503, 'Stockage indisponible.');
  const user = await verifierUtilisateur(env, req);
  if (!user || (user.role !== 'admin' && user.role !== 'livreur')) return err(403, 'Accès réservé aux livreurs.');
  const body = (await req.json().catch(() => null)) as { lat?: unknown; lng?: unknown } | null;
  const lat = Number(body?.lat);
  const lng = Number(body?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return err(400, 'Coordonnées GPS invalides.');
  }
  let monLiv = await trouverMonLivreur(sb, user);
  if (!monLiv && user.role === 'admin') {
    const r = await restFetch(sb, `livreurs?telephone=eq.${enc(livreurDefaut.whatsapp)}&select=*&limit=1`).catch(() => null);
    const rows = r && r.ok ? ((await r.json().catch(() => [])) as LivreurGestion[]) : [];
    monLiv = rows[0] ?? null;
  }
  if (!monLiv) return err(404, 'Fiche livreur introuvable.');
  const at = new Date().toISOString();
  const res = await restFetch(
    sb,
    `livreurs?id=eq.${enc(monLiv.id)}`,
    { method: 'PATCH', body: JSON.stringify({ last_lat: lat, last_lng: lng, last_seen_at: at, updated_at: at }) },
    { 'Content-Type': 'application/json', Prefer: 'return=minimal' },
  );
  if (!res.ok) return err(500, 'Impossible de sauvegarder la position.');
  return json({ ok: true, livreur_id: monLiv.id, lat, lng, at });
}

/** Suivi public d'une commande pour les clients invités : GET /api/suivi?ref=XXXXXX&tel=22111222 */
export async function suiviPublic(req: Request, env: Env): Promise<Response> {
  const sb = configSupabase(env);
  if (!sb) return err(503, 'Service indisponible.');
  const u = new URL(req.url);
  const ref = (u.searchParams.get('ref') ?? '').trim().toUpperCase();
  const tel = normaliserTelephone(u.searchParams.get('tel') ?? '');
  if (!/^[A-Z0-9]{4,12}$/.test(ref) || !tel) {
    return err(400, 'Indiquez le numéro de commande (ex. TEST01) et votre numéro de téléphone.');
  }
  const res = await restFetch(
    sb,
    `commandes?ref=eq.${enc(ref)}&client_telephone=eq.${enc(tel)}&select=id,ref,type,statut,creee,fin,statut_updated_at,historique_statuts,titre,lignes,client_nom,adresse,note,total,resto_slug,livreur_id,livreur_nom&limit=1`,
  );
  if (!res.ok) return err(500, 'Erreur de recherche.');
  const rows = (await res.json()) as Partial<CommandeSuivi>[];
  if (!rows[0]) return err(404, 'Aucune commande trouvée avec ce numéro et ce téléphone.');
  const [avecPos] = await attacherPositionsLivreurs(sb, [rows[0]]);
  return json({ commande: avecPos });
}

// =============================================================================
// RESTAURANTS LIVE (PUBLIC + HELPER COMMANDE)
// =============================================================================

export async function lireRestaurantsGestion(env: EnvStockage, slug?: string): Promise<RestaurantGestion[]> {
  const sb = configSupabase(env);
  if (!sb) return [];
  const q = slug && SLUG_RE.test(slug)
    ? `restaurants_gestion?slug=eq.${enc(slug)}&select=*&limit=1`
    : 'restaurants_gestion?select=*&order=updated_at.desc&limit=500';
  const res = await restFetch(sb, q).catch(() => null);
  if (!res || !res.ok) return [];
  return (await res.json().catch(() => [])) as RestaurantGestion[];
}

/** GET /api/restos-live[?slug=xxx] : renvoie les surcharges et restos ajoutés par l'admin. */
export async function endpointRestosLive(req: Request, env: Env): Promise<Response> {
  const slug = new URL(req.url).searchParams.get('slug') ?? undefined;
  const rows = await lireRestaurantsGestion(env, slug);
  if (slug) {
    return json({ restaurant: rows[0] ?? null });
  }
  const overrides: Record<string, RestaurantGestion> = {};
  const custom: RestaurantGestion[] = [];
  for (const r of rows) {
    if (r.source === 'custom') custom.push(r);
    else overrides[r.slug] = r;
  }
  return json({ overrides, custom });
}

/**
 * Construit un DonneesResto (utilisé par `traiterCommande` et `/resto-live`) pour un restaurant custom
 * ou applique les modifications/ajouts de plats sur un restaurant statique.
 */
export function fusionnerDonneesResto(
  statique: DonneesResto | null,
  gestion: RestaurantGestion | null,
  mediaBase: string,
  villePosition: { lat: number; lng: number } = { lat: 34.7406, lng: 10.7603 },
): { donnees: DonneesResto | null; desactive: boolean } {
  if (gestion && !gestion.actif) return { donnees: null, desactive: true };
  if (!statique && (!gestion || gestion.source !== 'custom')) return { donnees: null, desactive: false };

  const modifs = gestion?.plats_overrides?.modifs ?? {};
  const ajouts = gestion?.plats_overrides?.ajouts ?? [];

  if (!statique && gestion) {
    const catNoms = Array.from(new Set(ajouts.filter((p) => !p.indispo).map((p) => p.categorie || 'Carte')));
    const categories = catNoms.map((nom, i) => ({ id: i + 1, nom }));
    const catIdParNom = new Map(categories.map((c) => [c.nom, c.id]));
    const plats: Plat[] = ajouts
      .filter((p) => !p.indispo)
      .map((p) => ({
        id: p.id,
        categorieId: catIdParNom.get(p.categorie || 'Carte') ?? 1,
        nom: p.nom,
        description: p.description ?? '',
        prix: p.prix,
        prixOrigine: null,
        populaire: false,
        image: p.image ?? null,
        groupes: [],
      }));
    return {
      desactive: false,
      donnees: {
        media: mediaBase,
        resto: {
          id: 900000,
          slug: gestion.slug,
          nom: gestion.nom || gestion.slug,
          adresse: gestion.adresse || 'Sfax',
          telephone: gestion.telephone || '',
          position: gestion.position ?? villePosition,
          logo: gestion.image ?? null,
          couverture: gestion.image ?? null,
          note: 5,
          nbAvis: 0,
          delai: gestion.delai || '25-35 min',
          popularite: 1000,
          cuisines: gestion.cuisines ?? [],
          categories: catNoms,
          horaires: gestion.horaires ?? [],
          plats: plats.map((p) => p.nom),
        },
        menu: { restoId: 900000, categories, plats },
      },
    };
  }

  // Restaurant statique + éventuelles surcharges admin
  if (!statique || !gestion) return { donnees: statique, desactive: false };

  const categories = [...statique.menu.categories];
  let nextCatId = categories.reduce((m, c) => Math.max(m, c.id), 0) + 1;
  const assurerCat = (nom: string) => {
    const ex = categories.find((c) => c.nom.toLowerCase() === nom.toLowerCase());
    if (ex) return ex.id;
    const id = nextCatId++;
    categories.push({ id, nom });
    return id;
  };

  const plats: Plat[] = [];
  for (const p of statique.menu.plats) {
    const m = modifs[String(p.id)];
    if (m?.indispo) continue;
    plats.push({
      ...p,
      ...(m?.nom ? { nom: m.nom } : {}),
      ...(typeof m?.prix === 'number' ? { prix: m.prix } : {}),
      ...(m?.description !== undefined ? { description: m.description } : {}),
      ...(m?.categorie ? { categorieId: assurerCat(m.categorie) } : {}),
    });
  }
  for (const a of ajouts) {
    if (a.indispo) continue;
    plats.push({
      id: a.id,
      categorieId: assurerCat(a.categorie || 'Nouveautés'),
      nom: a.nom,
      description: a.description ?? '',
      prix: a.prix,
      prixOrigine: null,
      populaire: false,
      image: a.image ?? null,
      groupes: [],
    });
  }

  return {
    desactive: false,
    donnees: {
      ...statique,
      resto: {
        ...statique.resto,
        ...(gestion.nom ? { nom: gestion.nom } : {}),
        ...(gestion.adresse ? { adresse: gestion.adresse } : {}),
        ...(gestion.telephone ? { telephone: gestion.telephone } : {}),
        ...(gestion.cuisines ? { cuisines: gestion.cuisines } : {}),
        ...(gestion.delai ? { delai: gestion.delai } : {}),
        ...(gestion.position ? { position: gestion.position } : {}),
        ...(gestion.horaires ? { horaires: gestion.horaires } : {}),
        ...(gestion.image ? { couverture: gestion.image, logo: gestion.image } : {}),
      },
      menu: { restoId: statique.menu.restoId, categories, plats },
    },
  };
}

// =============================================================================
// ESPACE ADMIN (/api/admin/*)
// =============================================================================

const AdminMajCommandeSchema = z.object({
  id: z.string().min(5),
  statut: z.enum(STATUTS_COMMANDE).optional(),
  livreur_id: z.string().uuid().nullable().optional(),
  livreur_nom: z.string().max(100).nullable().optional(),
  prendre_moi_meme: z.boolean().optional(),
  notifier_client: z.boolean().optional(),
});

const AdminMajClientSchema = z.object({
  id: z.string().uuid(),
  notes_admin: z.string().max(1000).nullable().optional(),
  tags: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
  marketing_email: z.boolean().optional(),
  marketing_whatsapp: z.boolean().optional(),
});

const AdminNotifierSchema = z.object({
  canal: z.enum(['email', 'whatsapp']),
  client_ids: z.array(z.string().uuid()).min(1).max(200),
  sujet: z.string().trim().max(160).optional(),
  message: z.string().trim().min(2, 'Écrivez un message.').max(2000),
});

const AdminLivreurSchema = z.object({
  id: z.string().uuid().optional(),
  nom: z.string().trim().min(2).max(100),
  telephone: z.string().trim().min(8).max(30),
  email: z.string().trim().email().max(160).optional().or(z.literal('')),
  password: z.string().min(6, 'Mot de passe : 6 caractères minimum.').max(100).optional().or(z.literal('')),
  ville: z.string().trim().min(2).max(80).default('Sfax'),
  vehicule: z.string().trim().max(60).optional().or(z.literal('')),
  actif: z.boolean().optional(),
  disponible: z.boolean().optional(),
  commission_type: z.enum(['fixe', 'pourcent']).optional(),
  commission_valeur: z.number().min(0).max(500).optional(),
  notes: z.string().trim().max(500).optional().or(z.literal('')),
});

const PlatOverrideSchema = z.object({
  nom: z.string().trim().min(1).max(140).optional(),
  prix: z.number().min(0).max(5000).optional(),
  description: z.string().trim().max(400).optional(),
  categorie: z.string().trim().min(1).max(80).optional(),
  indispo: z.boolean().optional(),
});

const PlatCustomSchema = z.object({
  id: z.number().int().min(1),
  nom: z.string().trim().min(1).max(140),
  prix: z.number().min(0).max(5000),
  description: z.string().trim().max(400).optional(),
  categorie: z.string().trim().min(1).max(80).default('Carte'),
  image: z.string().trim().max(500).nullable().optional(),
  indispo: z.boolean().optional(),
});

const AdminRestaurantSchema = z.object({
  slug: z.string().trim().max(120).optional(),
  source: z.enum(['override', 'custom']).optional(),
  actif: z.boolean().optional(),
  nom: z.string().trim().min(1).max(140).nullable().optional(),
  adresse: z.string().trim().max(240).nullable().optional(),
  telephone: z.string().trim().max(40).nullable().optional(),
  email: z.string().trim().email().max(160).nullable().optional().or(z.literal('')),
  cuisines: z.array(z.string().trim().min(1).max(50)).max(15).nullable().optional(),
  type_commerce: z.enum(['restaurants', 'epicerie', 'patisserie', 'cafe', 'fleurs', 'para', 'animaux']).nullable().optional(),
  image: z.string().trim().max(500).nullable().optional(),
  delai: z.string().trim().max(40).nullable().optional(),
  position: z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) }).nullable().optional(),
  plats_overrides: z
    .object({
      modifs: z.record(z.string(), PlatOverrideSchema).optional(),
      ajouts: z.array(PlatCustomSchema).max(200).optional(),
    })
    .optional(),
});

function personnaliserMessage(modele: string, client: { nom: string; nb_commandes: number }): string {
  return modele
    .replace(/\{nom\}/gi, client.nom || 'Client')
    .replace(/\{prenom\}/gi, (client.nom || 'Client').split(' ')[0])
    .replace(/\{commandes\}/gi, String(client.nb_commandes));
}

const echapperHtml = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const fmtDt = (n: number) => `${Number(n).toFixed(3).replace('.', ',')} DT`;

/** Trouve la fiche `public.livreurs` d'un utilisateur connecté (admin ou sous-livreur). */
async function trouverMonLivreur(sb: { url: string; cle: string }, user: ProfilUtilisateur): Promise<LivreurGestion | null> {
  const q = user.telephone
    ? `livreurs?or=(user_id.eq.${enc(user.id)},telephone.eq.${enc(user.telephone)})&select=*&limit=1`
    : `livreurs?user_id=eq.${enc(user.id)}&select=*&limit=1`;
  const r = await restFetch(sb, q).catch(() => null);
  if (!r || !r.ok) return null;
  const rows = (await r.json().catch(() => [])) as LivreurGestion[];
  return rows[0] ?? null;
}

/** Crée ou met à jour un compte Supabase Auth (rôle `livreur`) + profil pour un sous-livreur. */
async function creerOuMajCompteLivreur(
  sb: { url: string; cle: string },
  data: { email: string; password: string; nom: string; telephone: string; actif: boolean },
): Promise<{ userId: string } | { erreur: string }> {
  const email = data.email.trim().toLowerCase();
  const h = authAdminHeaders(sb.cle);
  const listRes = await fetch(`${sb.url}/auth/v1/admin/users?page=1&per_page=200`, { headers: h }).catch(() => null);
  if (!listRes || !listRes.ok) return { erreur: 'Impossible de contacter le service comptes.' };
  const listData = (await listRes.json().catch(() => ({ users: [] }))) as { users?: { id: string; email?: string; app_metadata?: { role?: string } }[] };
  const existant = (listData.users ?? []).find((u) => (u.email ?? '').toLowerCase() === email);

  let userId: string;
  if (existant) {
    if (existant.app_metadata?.role === 'admin') {
      return { erreur: 'Cet email appartient déjà à un administrateur.' };
    }
    userId = existant.id;
    const upd = await fetch(`${sb.url}/auth/v1/admin/users/${userId}`, {
      method: 'PUT',
      headers: h,
      body: JSON.stringify({ password: data.password, email_confirm: true, app_metadata: { role: 'livreur' }, user_metadata: { nom: data.nom } }),
    });
    if (!upd.ok) return { erreur: 'Impossible de mettre à jour le compte livreur.' };
  } else {
    const cre = await fetch(`${sb.url}/auth/v1/admin/users`, {
      method: 'POST',
      headers: h,
      body: JSON.stringify({ email, password: data.password, email_confirm: true, app_metadata: { role: 'livreur' }, user_metadata: { nom: data.nom } }),
    });
    if (!cre.ok) return { erreur: 'Impossible de créer le compte livreur.' };
    const created = (await cre.json()) as { id: string };
    userId = created.id;
  }

  await restFetch(
    sb,
    'profiles?on_conflict=id',
    {
      method: 'POST',
      body: JSON.stringify({
        id: userId,
        email,
        role: 'livreur',
        nom: data.nom,
        telephone: data.telephone,
        actif: data.actif,
        marketing_opt_in: false,
        updated_at: new Date().toISOString(),
      }),
    },
    { 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
  ).catch(() => {});

  return { userId };
}

function detailsAffectationEmail(cmd: CommandeSuivi, livNom: string, origine: string, nomSite: string) {
  const lignesTxt = (cmd.lignes ?? []).map((l) => `- ${l}`).join('\n');
  const texte = [
    `Bonjour ${livNom},`,
    '',
    `Une commande vous a été affectée sur ${nomSite} :`,
    `N° ${cmd.ref} — ${cmd.titre}`,
    `Montant à encaisser : ${fmtDt(cmd.total)}`,
    '',
    'Articles :',
    lignesTxt,
    '',
    `Client : ${cmd.client_nom}`,
    `Téléphone : +${cmd.client_telephone}`,
    `Adresse : ${cmd.adresse}`,
    ...(cmd.note ? [`Note : ${cmd.note}`] : []),
    '',
    `Gérer la commande : ${origine}/admin`,
  ].join('\n');

  const html = `<!doctype html><html><body style="font-family:system-ui,sans-serif;background:#f6f7fb;padding:16px;color:#111">
<div style="max-width:520px;margin:0 auto;background:#fff;border-radius:20px;padding:20px">
<h2 style="margin:0 0 8px">🛵 Nouvelle commande affectée — N° ${echapperHtml(cmd.ref)}</h2>
<p style="margin:0 0 12px;color:#555">Bonjour <b>${echapperHtml(livNom)}</b>, voici tous les détails :</p>
<div style="background:#f6f7fb;border-radius:14px;padding:14px;margin-bottom:14px">
<div style="font-size:17px;font-weight:800">${echapperHtml(cmd.titre)} — <span style="color:#1a6be0">${echapperHtml(fmtDt(cmd.total))}</span></div>
<ul style="margin:8px 0 0;padding-left:18px">${(cmd.lignes ?? []).map((l) => `<li>${echapperHtml(l)}</li>`).join('')}</ul>
</div>
<p style="margin:0 0 6px"><b>👤 Client :</b> ${echapperHtml(cmd.client_nom)}</p>
<p style="margin:0 0 6px"><b>📞 Téléphone :</b> <a href="tel:+${echapperHtml(cmd.client_telephone)}">+${echapperHtml(cmd.client_telephone)}</a></p>
<p style="margin:0 0 6px"><b>📍 Adresse :</b> ${echapperHtml(cmd.adresse)}</p>
${cmd.note ? `<p style="margin:0 0 12px"><b>📝 Note :</b> ${echapperHtml(cmd.note)}</p>` : ''}
<a href="${echapperHtml(origine)}/admin" style="display:inline-block;margin-top:12px;background:#141a2b;color:#fff;text-decoration:none;font-weight:800;padding:12px 20px;border-radius:12px">Ouvrir mon espace livreur</a>
</div></body></html>`;

  return { texte, html };
}

export async function gererAdmin(req: Request, env: Env, livreur: Livreur, section: string): Promise<Response> {
  const sb = configSupabase(env);
  if (!sb) return err(503, 'Supabase non configuré.');
  const admin = await verifierUtilisateur(env, req);
  if (!admin) return err(401, 'Connexion requise.');
  if (admin.role !== 'admin' && admin.role !== 'livreur') return err(403, 'Accès réservé à l’administrateur.');
  // Seul l'admin a accès aux sections CRM, livreurs, restaurants, réglages, tracking global, upload et notifications.
  if (admin.role !== 'admin' && section !== 'commandes' && section !== 'stats' && section !== 'notifier-resto') {
    return err(403, 'Accès réservé à l’administrateur.');
  }

  const monLivreur = admin.role === 'livreur' ? await trouverMonLivreur(sb, admin) : null;

  // --- REGLAGES LIVREUR (Pause, Horaires, Frais, Colis, Promos, Coupons, Commission, Annonce, Pourboires...) ---
  if (section === 'reglages') {
    const store = stockage(env);
    if (!store) return err(503, 'Stockage indisponible.');
    if (req.method === 'GET') {
      const config = await store.lireConfig(livreur.whatsapp);
      const effectif = reglages(livreur, config);
      const pauseActive = pauseEnCours(config, new Date());
      return json({
        config,
        effectif,
        pauseActive,
        livreur: { nom: livreur.nom, ville: livreur.ville, whatsapp: livreur.whatsapp, email: livreur.email },
      });
    }
    if (req.method === 'PATCH' || req.method === 'POST') {
      const body = await req.json().catch(() => null);
      if (!body || typeof body !== 'object') return err(400, 'Réglages invalides.');
      const cur = await store.lireConfig(livreur.whatsapp);
      const fusion: Record<string, unknown> = { ...cur, ...(body as Record<string, unknown>) };
      // Les champs passés à `undefined` sont supprimés, `null` est conservé (ex: service: null, livraisonGratuite: null)
      for (const [k, v] of Object.entries(fusion)) {
        if (v === undefined) delete fusion[k];
      }
      const parsed = ConfigSchema.safeParse(fusion);
      if (!parsed.success) {
        return err(400, parsed.error.issues[0]?.message ?? 'Valeurs de réglages invalides.');
      }
      await store.ecrireConfig(livreur.whatsapp, parsed.data);
      const effectif = reglages(livreur, parsed.data);
      const pauseActive = pauseEnCours(parsed.data, new Date());
      return json({ config: parsed.data, effectif, pauseActive });
    }
  }

  // --- STATS ---
  if (section === 'stats' && req.method === 'GET') {
    if (admin.role === 'livreur') {
      if (!monLivreur) {
        return json({ stats: { totalCommandes: 0, enCours: 0, livrees: 0, chiffreAffaires: 0, aRecupererEquipe: 0, aRendreAdmin: 0, totalClients: 0, clientsAvecEmail: 0, livreursActifs: 0, livreursDisponibles: 0, restosCustom: 0, restosDesactives: 0 }, monLivreur: null });
      }
      const cmdRes = await restFetch(sb, `commandes?livreur_id=eq.${enc(monLivreur.id)}&select=statut,total,part_admin,regle_admin&limit=500`);
      const cmds = cmdRes.ok ? ((await cmdRes.json()) as { statut: StatutCommande; total: number | string; part_admin?: number | string; regle_admin?: boolean }[]) : [];
      const enCours = cmds.filter((c) => c.statut !== 'livree' && c.statut !== 'annulee').length;
      const livrees = cmds.filter((c) => c.statut === 'livree').length;
      const chiffreAffaires = Number(cmds.filter((c) => c.statut !== 'annulee').reduce((s, c) => s + Number(c.total), 0).toFixed(3));
      const aRendreAdmin = Number(
        cmds
          .filter((c) => c.statut === 'livree' && !c.regle_admin)
          .reduce((s, c) => s + Number(c.part_admin ?? 0), 0)
          .toFixed(3),
      );
      return json({
        stats: { totalCommandes: cmds.length, enCours, livrees, chiffreAffaires, aRecupererEquipe: 0, aRendreAdmin, totalClients: 0, clientsAvecEmail: 0, livreursActifs: 1, livreursDisponibles: monLivreur.disponible ? 1 : 0, restosCustom: 0, restosDesactives: 0 },
        monLivreur,
      });
    }

    const [cmdRes, cliRes, livRes, restoRes] = await Promise.all([
      restFetch(sb, 'commandes?select=statut,total,part_admin,regle_admin&limit=1000'),
      restFetch(sb, 'clients_crm?select=id,email,marketing_email,marketing_whatsapp&limit=1000'),
      restFetch(sb, 'livreurs?select=id,actif,disponible&limit=200'),
      restFetch(sb, 'restaurants_gestion?select=slug,source,actif&limit=500'),
    ]);
    const cmds = cmdRes.ok ? ((await cmdRes.json()) as { statut: StatutCommande; total: number | string; part_admin?: number | string; regle_admin?: boolean }[]) : [];
    const clis = cliRes.ok ? ((await cliRes.json()) as { id: string; email: string | null; marketing_email: boolean; marketing_whatsapp: boolean }[]) : [];
    const livs = livRes.ok ? ((await livRes.json()) as { id: string; actif: boolean; disponible: boolean }[]) : [];
    const restos = restoRes.ok ? ((await restoRes.json()) as { slug: string; source: string; actif: boolean }[]) : [];

    const enCours = cmds.filter((c) => c.statut !== 'livree' && c.statut !== 'annulee').length;
    const livrees = cmds.filter((c) => c.statut === 'livree').length;
    const chiffreAffaires = Number(cmds.filter((c) => c.statut !== 'annulee').reduce((s, c) => s + Number(c.total), 0).toFixed(3));
    const aRecupererEquipe = Number(
      cmds
        .filter((c) => c.statut === 'livree' && !c.regle_admin)
        .reduce((s, c) => s + Number(c.part_admin ?? 0), 0)
        .toFixed(3),
    );
    return json({
      stats: {
        totalCommandes: cmds.length,
        enCours,
        livrees,
        chiffreAffaires,
        aRecupererEquipe,
        aRendreAdmin: 0,
        totalClients: clis.length,
        clientsAvecEmail: clis.filter((c) => Boolean(c.email)).length,
        livreursActifs: livs.filter((l) => l.actif).length,
        livreursDisponibles: livs.filter((l) => l.actif && l.disponible).length,
        restosCustom: restos.filter((r) => r.source === 'custom').length,
        restosDesactives: restos.filter((r) => !r.actif).length,
      },
    });
  }

  // --- COMMANDES ---
  if (section === 'commandes') {
    const champsCmd = 'id,ref,type,statut,creee,fin,statut_updated_at,historique_statuts,titre,lignes,client_nom,client_telephone,client_email,adresse,note,total,resto_slug,livreur_id,livreur_nom,user_id,part_admin,regle_admin,regle_admin_at,resto_telephone,resto_notifie_at';
    if (req.method === 'GET') {
      const u = new URL(req.url);
      const statut = u.searchParams.get('statut');
      const filtreStatut = statut && (STATUTS_COMMANDE as readonly string[]).includes(statut) ? `&statut=eq.${enc(statut)}` : '';
      if (admin.role === 'livreur') {
        if (!monLivreur) return json({ commandes: [], monLivreur: null });
        const res = await restFetch(
          sb,
          `commandes?livreur_id=eq.${enc(monLivreur.id)}&select=${champsCmd}&order=creee.desc&limit=100${filtreStatut}`,
        );
        if (!res.ok) return err(500, 'Erreur lecture commandes.');
        return json({ commandes: await res.json(), monLivreur });
      }
      const res = await restFetch(
        sb,
        `commandes?select=${champsCmd}&order=creee.desc&limit=100${filtreStatut}`,
      );
      if (!res.ok) return err(500, 'Erreur lecture commandes.');
      return json({ commandes: await res.json() });
    }

    if (req.method === 'PATCH') {
      const body = await req.json().catch(() => null);
      const parsed = AdminMajCommandeSchema.safeParse(body);
      if (!parsed.success) return err(400, 'Données invalides.');
      const curRes = await restFetch(sb, `commandes?id=eq.${enc(parsed.data.id)}&select=*&limit=1`);
      const rows = curRes.ok ? ((await curRes.json()) as CommandeSuivi[]) : [];
      const cur = rows[0];
      if (!cur) return err(404, 'Commande introuvable.');

      // Un sous-livreur ne peut mettre à jour que les commandes qui lui sont affectées (et uniquement le statut).
      if (admin.role === 'livreur') {
        if (!monLivreur || cur.livreur_id !== monLivreur.id) {
          return err(403, 'Cette commande ne vous est pas affectée.');
        }
      }

      const now = new Date().toISOString();
      const hist = Array.isArray(cur.historique_statuts) ? [...cur.historique_statuts] : [];
      const patch: Record<string, unknown> = {};
      let nouveauStatut: StatutCommande | undefined = parsed.data.statut;
      let livreurAffecte: LivreurGestion | null = null;

      if (admin.role === 'admin') {
        if (parsed.data.prendre_moi_meme) {
          const moiLiv = await trouverMonLivreur(sb, admin);
          patch.livreur_id = moiLiv?.id ?? null;
          patch.livreur_nom = moiLiv?.nom ?? (admin.nom || livreur.nom);
          patch.part_admin = 0;
          if (!nouveauStatut && cur.statut === 'nouvelle') nouveauStatut = 'confirmee';
        } else if (parsed.data.livreur_id !== undefined) {
          patch.livreur_id = parsed.data.livreur_id;
          if (parsed.data.livreur_id) {
            const lr = await restFetch(sb, `livreurs?id=eq.${enc(parsed.data.livreur_id)}&select=*&limit=1`);
            const lrows = lr.ok ? ((await lr.json().catch(() => [])) as LivreurGestion[]) : [];
            livreurAffecte = lrows[0] ?? null;
            patch.livreur_nom = livreurAffecte?.nom ?? parsed.data.livreur_nom ?? null;
            // Si affectée à un sous-livreur (pas le compte admin lui-même), on calcule la part Admin !
            if (livreurAffecte && livreurAffecte.user_id !== admin.id) {
              patch.part_admin = calculerPartAdmin(
                Number(cur.total),
                livreurAffecte.commission_type ?? 'fixe',
                Number(livreurAffecte.commission_valeur ?? 1),
              );
            } else {
              patch.part_admin = 0;
            }
          } else {
            patch.livreur_nom = null;
            patch.part_admin = 0;
          }
        } else if (parsed.data.livreur_nom !== undefined) {
          patch.livreur_nom = parsed.data.livreur_nom;
        }
      }

      if (nouveauStatut && nouveauStatut !== cur.statut) {
        patch.statut = nouveauStatut;
        patch.statut_updated_at = now;
        patch.fin = nouveauStatut === 'livree' || nouveauStatut === 'annulee' ? now : null;
        hist.push({ statut: nouveauStatut, at: now });
        patch.historique_statuts = hist;
        // Quand un sous-livreur passe la commande en 'livree', s'assurer que part_admin est bien calculée
        if (nouveauStatut === 'livree' && patch.part_admin === undefined && !Number(cur.part_admin ?? 0)) {
          const livObj = monLivreur ?? (cur.livreur_id ? await restFetch(sb, `livreurs?id=eq.${enc(cur.livreur_id)}&select=*&limit=1`).then((r) => (r.ok ? r.json() : [])).then((a: LivreurGestion[]) => a[0] ?? null).catch(() => null) : null);
          if (livObj && (admin.role === 'livreur' || livObj.user_id !== admin.id)) {
            patch.part_admin = calculerPartAdmin(Number(cur.total), livObj.commission_type ?? 'fixe', Number(livObj.commission_valeur ?? 1));
          }
        }
      }

      const updRes = await restFetch(
        sb,
        `commandes?id=eq.${enc(cur.id)}&select=*`,
        { method: 'PATCH', body: JSON.stringify(patch) },
        { 'Content-Type': 'application/json', Prefer: 'return=representation' },
      );
      if (!updRes.ok) return err(500, 'Impossible de mettre à jour la commande.');
      const [maj] = (await updRes.json()) as CommandeSuivi[];

      const origine = new URL(req.url).origin;
      const notifications: { livreurEmail?: string; livreurPush?: number; clientEmail?: string; adminEmail?: string; whatsappLivreurUrl?: string } = {};
      const taches: Promise<unknown>[] = [];

      // 1. Affectation à un sous-livreur : email complet + notification Push sur son téléphone !
      const nouvelleAffectation = livreurAffecte && livreurAffecte.id !== cur.livreur_id;
      if (nouvelleAffectation && livreurAffecte) {
        const { texte, html } = detailsAffectationEmail(maj, livreurAffecte.nom, origine, livreur.nom);
        notifications.whatsappLivreurUrl = `https://wa.me/${livreurAffecte.telephone}?text=${encodeURIComponent(texte)}`;
        if (livreurAffecte.email) {
          taches.push(
            envoyerEmail(
              livreurAffecte.email,
              `🛵 Nouvelle commande affectée N° ${maj.ref} — ${maj.titre} (${fmtDt(maj.total)})`,
              texte,
              env,
              html,
            ).then((st) => { notifications.livreurEmail = st; }).catch(() => {}),
          );
        }
        taches.push(
          alerterPushTelephone(req, env, livreurAffecte.telephone)
            .then((n) => { notifications.livreurPush = n; })
            .catch(() => {}),
        );
      }

      // 2. Notification email au client lors d'un changement de statut ou d'une affectation livreur
      const notifierClient = parsed.data.notifier_client !== false;
      if (notifierClient && maj.client_email && (nouveauStatut || nouvelleAffectation)) {
        const lib = LIBELLES_STATUT[maj.statut];
        taches.push(
          envoyerEmail(
            maj.client_email,
            `Mise à jour commande N° ${maj.ref} — ${lib}`,
            `Bonjour ${maj.client_nom},\n\nVotre commande N° ${maj.ref} (${maj.titre}) est maintenant : ${lib}.${maj.livreur_nom ? `\nLivreur en charge : ${maj.livreur_nom}` : ''}\n\nSuivez votre commande en direct : ${origine}/compte?ref=${encodeURIComponent(maj.ref)}\n\n${livreur.nom}`,
            env,
          ).then((st) => { notifications.clientEmail = st; }).catch(() => {}),
        );
      }

      // 3. Si un sous-livreur change le statut d'une commande : notifier l'Admin (email + push) !
      if (admin.role === 'livreur' && nouveauStatut && nouveauStatut !== cur.statut) {
        const lib = LIBELLES_STATUT[nouveauStatut];
        taches.push(
          envoyerEmail(
            livreur.email,
            `🛵 Suivi livreur : N° ${maj.ref} → ${lib} (${monLivreur?.nom ?? admin.nom})`,
            `Le livreur ${monLivreur?.nom ?? admin.nom} a passé la commande N° ${maj.ref} (${maj.titre}, client ${maj.client_nom}, ${fmtDt(maj.total)}) au statut : ${lib}.\n\nTableau de bord : ${origine}/admin`,
            env,
          ).then((st) => { notifications.adminEmail = st; }).catch(() => {}),
        );
        taches.push(alerterPushTelephone(req, env, livreur.whatsapp).catch(() => {}));
      }

      await Promise.all(taches);
      return json({ commande: maj, notifications });
    }
  }

  // --- CLIENTS CRM ---
  if (section === 'clients') {
    if (req.method === 'GET') {
      const [cliRes, campRes] = await Promise.all([
        restFetch(sb, 'clients_crm?select=*&order=derniere_commande_at.desc.nullslast,created_at.desc&limit=500'),
        restFetch(sb, 'campagnes_notifications?select=*&order=created_at.desc&limit=25'),
      ]);
      const clients = cliRes.ok ? await cliRes.json() : [];
      const campagnes = campRes.ok ? await campRes.json() : [];
      return json({ clients, campagnes });
    }

    if (req.method === 'PATCH') {
      const body = await req.json().catch(() => null);
      const parsed = AdminMajClientSchema.safeParse(body);
      if (!parsed.success) return err(400, 'Données client invalides.');
      const { id, ...fields } = parsed.data;
      const res = await restFetch(
        sb,
        `clients_crm?id=eq.${enc(id)}&select=*`,
        { method: 'PATCH', body: JSON.stringify({ ...fields, updated_at: new Date().toISOString() }) },
        { 'Content-Type': 'application/json', Prefer: 'return=representation' },
      );
      if (!res.ok) return err(500, 'Mise à jour impossible.');
      const [maj] = await res.json();
      return json({ client: maj });
    }
  }

  // --- NOTIFIER (Campagne Email ou WhatsApp) ---
  if (section === 'notifier' && req.method === 'POST') {
    const body = await req.json().catch(() => null);
    const parsed = AdminNotifierSchema.safeParse(body);
    if (!parsed.success) return err(400, parsed.error.issues[0]?.message ?? 'Paramètres invalides.');

    const inList = parsed.data.client_ids.map((id) => `"${id}"`).join(',');
    const cliRes = await restFetch(sb, `clients_crm?id=in.(${inList})&select=*`);
    if (!cliRes.ok) return err(500, 'Impossible de lire les clients.');
    const clients = (await cliRes.json()) as ClientCRM[];

    if (parsed.data.canal === 'email') {
      const sujet = parsed.data.sujet?.trim() || `Nouvelles de ${livreur.nom}`;
      const cibles = clients.filter((c) => c.email && c.marketing_email);
      let envoyes = 0;
      const resultats: { id: string; nom: string; email: string; statut: string }[] = [];
      for (const c of cibles) {
        const msg = personnaliserMessage(parsed.data.message, c);
        const st = await envoyerEmail(c.email!, sujet, msg, env);
        if (st === 'sent') envoyes++;
        resultats.push({ id: c.id, nom: c.nom, email: c.email!, statut: st });
      }
      await restFetch(
        sb,
        'campagnes_notifications',
        {
          method: 'POST',
          body: JSON.stringify({
            canal: 'email',
            sujet,
            message: parsed.data.message,
            nb_destinataires: cibles.length,
            nb_envoyes: envoyes,
            cree_par: admin.id,
          }),
        },
        { 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      ).catch(() => {});
      return json({ canal: 'email', nb_destinataires: cibles.length, nb_envoyes: envoyes, resultats });
    }

    // Canal WhatsApp : prépare les liens directs personnalisés wa.me pour chaque client
    const cibles = clients.filter((c) => c.marketing_whatsapp);
    const liens = cibles.map((c) => {
      const texte = personnaliserMessage(parsed.data.message, c);
      return {
        id: c.id,
        nom: c.nom,
        telephone: c.telephone,
        url: `https://wa.me/${c.telephone}?text=${encodeURIComponent(texte)}`,
        texte,
      };
    });
    await restFetch(
      sb,
      'campagnes_notifications',
      {
        method: 'POST',
        body: JSON.stringify({
          canal: 'whatsapp',
          sujet: parsed.data.sujet || 'Message WhatsApp',
          message: parsed.data.message,
          nb_destinataires: liens.length,
          nb_envoyes: liens.length,
          cree_par: admin.id,
        }),
      },
      { 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    ).catch(() => {});
    return json({ canal: 'whatsapp', nb_destinataires: liens.length, liens });
  }

  // --- LIVREURS + BILAN DES GAINS ADMIN ---
  if (section === 'livreurs') {
    if (req.method === 'GET') {
      const [livRes, cmdRes] = await Promise.all([
        restFetch(sb, 'livreurs?select=*&order=actif.desc,nom.asc'),
        restFetch(sb, 'commandes?statut=eq.livree&livreur_id=not.is.null&select=livreur_id,total,part_admin,regle_admin,fin,creee&limit=2000'),
      ]);
      if (!livRes.ok) return err(500, 'Erreur lecture livreurs.');
      const livreursListe = (await livRes.json()) as LivreurGestion[];
      const livrees = cmdRes.ok
        ? ((await cmdRes.json()) as { livreur_id: string; total: number | string; part_admin?: number | string; regle_admin?: boolean; fin?: string | null; creee: string }[])
        : [];
      const aujourdhui = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Tunis' }).format(new Date());
      const bilan: Record<string, BilanLivreur> = {};
      for (const l of livreursListe) {
        bilan[l.id] = { livreur_id: l.id, nb_livrees_total: 0, nb_livrees_aujourdhui: 0, nb_non_reglees: 0, ca_total: 0, a_recuperer: 0, deja_recupere: 0 };
      }
      for (const c of livrees) {
        const b = bilan[c.livreur_id];
        if (!b) continue;
        b.nb_livrees_total += 1;
        const d = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Tunis' }).format(new Date(c.fin || c.creee));
        if (d === aujourdhui) b.nb_livrees_aujourdhui += 1;
        b.ca_total = Number((b.ca_total + Number(c.total || 0)).toFixed(3));
        const part = Number(c.part_admin ?? 0);
        if (c.regle_admin) {
          b.deja_recupere = Number((b.deja_recupere + part).toFixed(3));
        } else {
          if (part > 0) b.nb_non_reglees += 1;
          b.a_recuperer = Number((b.a_recuperer + part).toFixed(3));
        }
      }
      const totalARecuperer = Number(Object.values(bilan).reduce((s, b) => s + b.a_recuperer, 0).toFixed(3));
      return json({ livreurs: livreursListe, bilan, totalARecuperer });
    }

    if (req.method === 'POST' || req.method === 'PATCH') {
      const body = await req.json().catch(() => null);
      const parsed = AdminLivreurSchema.safeParse(body);
      if (!parsed.success) return err(400, parsed.error.issues[0]?.message ?? 'Données livreur invalides.');
      const tel = normaliserTelephone(parsed.data.telephone);
      if (!tel) return err(400, 'Téléphone invalide (format tunisien 8 chiffres).');

      let userId: string | undefined;
      let compteCree = false;
      if (parsed.data.password) {
        if (!parsed.data.email) return err(400, 'Un email est requis pour créer le compte de connexion du sous-livreur.');
        const resCompte = await creerOuMajCompteLivreur(sb, {
          email: parsed.data.email,
          password: parsed.data.password,
          nom: parsed.data.nom,
          telephone: tel,
          actif: parsed.data.actif ?? true,
        });
        if ('erreur' in resCompte) return err(400, resCompte.erreur);
        userId = resCompte.userId;
        compteCree = true;
      }

      const payload = {
        ...(userId ? { user_id: userId } : {}),
        nom: parsed.data.nom,
        telephone: tel,
        email: parsed.data.email || null,
        ville: parsed.data.ville || 'Sfax',
        vehicule: parsed.data.vehicule || null,
        actif: parsed.data.actif ?? true,
        disponible: parsed.data.disponible ?? true,
        ...(parsed.data.commission_type !== undefined ? { commission_type: parsed.data.commission_type } : {}),
        ...(parsed.data.commission_valeur !== undefined ? { commission_valeur: parsed.data.commission_valeur } : {}),
        notes: parsed.data.notes || null,
        updated_at: new Date().toISOString(),
      };

      const res = parsed.data.id
        ? await restFetch(
            sb,
            `livreurs?id=eq.${enc(parsed.data.id)}&select=*`,
            { method: 'PATCH', body: JSON.stringify(payload) },
            { 'Content-Type': 'application/json', Prefer: 'return=representation' },
          )
        : await restFetch(
            sb,
            'livreurs?on_conflict=telephone&select=*',
            { method: 'POST', body: JSON.stringify(payload) },
            { 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=representation' },
          );
      if (!res.ok) return err(500, 'Impossible d’enregistrer le livreur.');
      const [row] = await res.json();
      return json({ livreur: row, compteCree }, parsed.data.id ? 200 : 201);
    }

    if (req.method === 'DELETE') {
      const id = new URL(req.url).searchParams.get('id') ?? '';
      if (!id) return err(400, 'ID requis.');
      const res = await restFetch(sb, `livreurs?id=eq.${enc(id)}`, { method: 'DELETE' });
      if (!res.ok) return err(500, 'Suppression impossible.');
      return json({ ok: true });
    }
  }

  // --- RÈGLEMENT DE CAISSE D'UN SOUS-LIVREUR (POST /api/admin/reglement) ---
  if (section === 'reglement' && req.method === 'POST') {
    const body = (await req.json().catch(() => null)) as { livreur_id?: unknown } | null;
    const idLiv = typeof body?.livreur_id === 'string' ? body.livreur_id : '';
    if (!/^[0-9a-f-]{36}$/i.test(idLiv)) return err(400, 'Livreur invalide.');
    const now = new Date().toISOString();
    const res = await restFetch(
      sb,
      `commandes?livreur_id=eq.${enc(idLiv)}&statut=eq.livree&regle_admin=eq.false&select=id,part_admin`,
      { method: 'PATCH', body: JSON.stringify({ regle_admin: true, regle_admin_at: now }) },
      { 'Content-Type': 'application/json', Prefer: 'return=representation' },
    );
    if (!res.ok) return err(500, 'Impossible d’enregistrer le règlement.');
    const maj = (await res.json()) as { id: string; part_admin?: number | string }[];
    const montant_regle = Number(maj.reduce((s, r) => s + Number(r.part_admin ?? 0), 0).toFixed(3));
    return json({ ok: true, nb_reglees: maj.length, montant_regle });
  }

  // --- RESTAURANTS ---
  if (section === 'restaurants') {
    if (req.method === 'GET') {
      const rows = await lireRestaurantsGestion(env);
      return json({ restaurants: rows });
    }

    if (req.method === 'POST' || req.method === 'PATCH') {
      const body = await req.json().catch(() => null);
      const parsed = AdminRestaurantSchema.safeParse(body);
      if (!parsed.success) return err(400, parsed.error.issues[0]?.message ?? 'Données restaurant invalides.');
      const slug = (parsed.data.slug && SLUG_RE.test(parsed.data.slug))
        ? parsed.data.slug
        : parsed.data.nom
          ? slugifier(parsed.data.nom)
          : '';
      if (!slug || !SLUG_RE.test(slug)) return err(400, 'Nom ou identifiant de restaurant invalide.');

      // Lire l'existant pour fusionner proprement les champs non envoyés
      const existants = await lireRestaurantsGestion(env, slug);
      const ex = existants[0];
      const payload = {
        slug,
        source: parsed.data.source ?? ex?.source ?? 'override',
        actif: parsed.data.actif ?? ex?.actif ?? true,
        nom: parsed.data.nom !== undefined ? parsed.data.nom : (ex?.nom ?? null),
        adresse: parsed.data.adresse !== undefined ? parsed.data.adresse : (ex?.adresse ?? null),
        telephone: parsed.data.telephone !== undefined ? parsed.data.telephone : (ex?.telephone ?? null),
        email: parsed.data.email !== undefined ? (parsed.data.email || null) : (ex?.email ?? null),
        cuisines: parsed.data.cuisines !== undefined ? parsed.data.cuisines : (ex?.cuisines ?? null),
        type_commerce: parsed.data.type_commerce !== undefined ? parsed.data.type_commerce : (ex?.type_commerce ?? 'restaurants'),
        image: parsed.data.image !== undefined ? parsed.data.image : (ex?.image ?? null),
        delai: parsed.data.delai !== undefined ? parsed.data.delai : (ex?.delai ?? null),
        position: parsed.data.position !== undefined ? parsed.data.position : (ex?.position ?? null),
        plats_overrides: parsed.data.plats_overrides !== undefined ? parsed.data.plats_overrides : (ex?.plats_overrides ?? {}),
        updated_at: new Date().toISOString(),
      };
      const res = await restFetch(
        sb,
        'restaurants_gestion?on_conflict=slug&select=*',
        { method: 'POST', body: JSON.stringify(payload) },
        { 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=representation' },
      );
      if (!res.ok) return err(500, 'Impossible d’enregistrer le restaurant.');
      const [row] = await res.json();
      return json({ restaurant: row }, ex ? 200 : 201);
    }

    if (req.method === 'DELETE') {
      const slug = new URL(req.url).searchParams.get('slug') ?? '';
      if (!SLUG_RE.test(slug)) return err(400, 'Slug invalide.');
      const res = await restFetch(sb, `restaurants_gestion?slug=eq.${enc(slug)}`, { method: 'DELETE' });
      if (!res.ok) return err(500, 'Suppression impossible.');
      return json({ ok: true });
    }
  }

  // --- UPLOAD IMAGE (POST /api/admin/upload → Supabase Storage bucket public `medias`) ---
  if (section === 'upload' && req.method === 'POST') {
    const body = (await req.json().catch(() => null)) as { dataUrl?: unknown; dossier?: unknown } | null;
    const dataUrl = typeof body?.dataUrl === 'string' ? body.dataUrl : '';
    const dossier = body?.dossier === 'logos' ? 'logos' : 'restos';
    const m = /^data:(image\/(?:jpeg|png|webp|gif));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
    if (!m) return err(400, 'Format d’image non supporté (JPG, PNG, WebP ou GIF uniquement).');
    const mime = m[1];
    const ext = mime === 'image/jpeg' ? 'jpg' : mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : 'gif';
    const binStr = atob(m[2]);
    if (binStr.length > 4 * 1024 * 1024) return err(413, 'Image trop lourde (4 Mo maximum).');
    const bytes = new Uint8Array(binStr.length);
    for (let i = 0; i < binStr.length; i++) bytes[i] = binStr.charCodeAt(i);
    const chemin = `${dossier}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`;
    const up = await fetch(`${sb.url}/storage/v1/object/medias/${chemin}`, {
      method: 'POST',
      headers: headersSupabase(sb.cle, { 'Content-Type': mime, 'x-upsert': 'true', 'cache-control': '31536000' }),
      body: bytes,
    });
    if (!up.ok) return err(500, 'Impossible d’envoyer l’image.');
    return json({ url: `${sb.url}/storage/v1/object/public/medias/${chemin}` }, 201);
  }

  // --- TRACKING GPS TEMPS RÉEL DE TOUTE L'ÉQUIPE (GET /api/admin/tracking) ---
  if (section === 'tracking' && req.method === 'GET') {
    const [livRes, cmdRes] = await Promise.all([
      restFetch(sb, 'livreurs?actif=eq.true&select=id,nom,telephone,vehicule,disponible,last_lat,last_lng,last_seen_at&order=nom.asc'),
      restFetch(sb, 'commandes?statut=in.(nouvelle,confirmee,en_preparation,en_livraison)&select=id,ref,titre,statut,client_nom,adresse,livreur_id,total&order=creee.desc&limit=100'),
    ]);
    const livs = livRes.ok ? ((await livRes.json()) as LivreurGestion[]) : [];
    const cmds = cmdRes.ok ? ((await cmdRes.json()) as Partial<CommandeSuivi>[]) : [];
    const parLiv = new Map<string, Partial<CommandeSuivi>[]>();
    for (const c of cmds) {
      if (!c.livreur_id) continue;
      const arr = parLiv.get(c.livreur_id) ?? [];
      arr.push(c);
      parLiv.set(c.livreur_id, arr);
    }
    return json({
      livreurs: livs.map((l) => ({
        ...l,
        commandesEnCours: parLiv.get(l.id) ?? [],
      })),
    });
  }

  // --- NOTIFIER / INFORMER LE RESTAURANT D'UNE COMMANDE (POST /api/admin/notifier-resto) ---
  if (section === 'notifier-resto' && req.method === 'POST') {
    const body = (await req.json().catch(() => null)) as { commande_id?: unknown; canal?: unknown; email_resto?: unknown; telephone_resto?: unknown } | null;
    const cmdId = typeof body?.commande_id === 'string' ? body.commande_id : '';
    const canal = body?.canal === 'email' || body?.canal === 'whatsapp' || body?.canal === 'appel' ? body.canal : 'whatsapp';
    if (!cmdId) return err(400, 'Commande requise.');

    const curRes = await restFetch(sb, `commandes?id=eq.${enc(cmdId)}&select=*&limit=1`);
    const rows = curRes.ok ? ((await curRes.json()) as CommandeSuivi[]) : [];
    const cmd = rows[0];
    if (!cmd) return err(404, 'Commande introuvable.');
    if (admin.role === 'livreur' && (!monLivreur || cmd.livreur_id !== monLivreur.id)) {
      return err(403, 'Commande non affectée.');
    }

    const gestions = cmd.resto_slug ? await lireRestaurantsGestion(env, cmd.resto_slug) : [];
    const gestion = gestions[0] ?? null;
    let telBrut =
      (typeof body?.telephone_resto === 'string' && body.telephone_resto.trim()) ||
      gestion?.telephone ||
      cmd.resto_telephone ||
      '';

    // Repli automatique sur le catalogue statique (/commande-data/<slug> puis /restos.json) si le numéro n'était pas en base
    if (!telBrut) {
      try {
        if (cmd.resto_slug && SLUG_RE.test(cmd.resto_slug)) {
          const rStat = await fetch(new URL(`/commande-data/${cmd.resto_slug}`, req.url));
          if (rStat.ok) {
            const dStat = (await rStat.json().catch(() => null)) as { resto?: { telephone?: string } } | null;
            if (dStat?.resto?.telephone) telBrut = dStat.resto.telephone;
          }
        }
        if (!telBrut) {
          const rIdx = await fetch(new URL('/restos.json', req.url));
          if (rIdx.ok) {
            const liste = (await rIdx.json().catch(() => [])) as { slug?: string; nom?: string; telephone?: string }[];
            const titreNorm = (cmd.titre || '').trim().toLowerCase();
            const match = liste.find(
              (r) =>
                (cmd.resto_slug && r.slug === cmd.resto_slug) ||
                (r.nom && r.nom.trim().toLowerCase() === titreNorm),
            );
            if (match?.telephone) telBrut = match.telephone;
          }
        }
      } catch {
        /* catalogue statique indisponible dans l'environnement courant */
      }
    }

    const telNorm = normaliserTelephone(telBrut);
    const emailResto = (typeof body?.email_resto === 'string' && body.email_resto.trim()) || gestion?.email || '';

    // Message propre pour le resto : AUCUNE coordonnée privée du client !
    const texteResto = [
      `Bonjour ${cmd.titre},`,
      '',
      `Nouvelle commande N° ${cmd.ref} à préparer (${livreur.nom}) :`,
      ...(cmd.lignes ?? []).map((l) => `- ${l}`),
      ...(cmd.note ? ['', `Remarque : ${cmd.note}`] : []),
      '',
      'Un livreur passe la récupérer. Merci de confirmer le délai !',
    ].join('\n');

    let emailStatut: string | undefined;
    if (canal === 'email') {
      if (!emailResto) return err(400, 'Aucun email configuré pour ce restaurant (ajoutez-le dans Restos & Prix ou saisissez-le).');
      const htmlResto = `<!doctype html><html><body style="font-family:system-ui,sans-serif;background:#f6f7fb;padding:16px;color:#111">
<div style="max-width:500px;margin:0 auto;background:#fff;border-radius:20px;padding:20px">
<h2 style="margin:0 0 8px">🍽️ Commande à préparer — N° ${echapperHtml(cmd.ref)}</h2>
<p style="margin:0 0 12px;color:#555">Bonjour <b>${echapperHtml(cmd.titre)}</b> (${echapperHtml(livreur.nom)}) :</p>
<ul style="background:#f6f7fb;border-radius:14px;padding:14px 14px 14px 30px;margin:0 0 12px">${(cmd.lignes ?? []).map((l) => `<li style="margin:4px 0"><b>${echapperHtml(l)}</b></li>`).join('')}</ul>
${cmd.note ? `<p style="margin:0 0 10px"><b>📝 Remarque :</b> ${echapperHtml(cmd.note)}</p>` : ''}
<p style="margin:0;color:#444">Un livreur passe récupérer la commande dès qu'elle est prête.</p>
</div></body></html>`;
      emailStatut = await envoyerEmail(emailResto, `🍽️ Commande N° ${cmd.ref} à préparer — ${cmd.titre}`, texteResto, env, htmlResto);
    }

    const now = new Date().toISOString();
    const patchResto: Record<string, unknown> = { resto_notifie_at: now };
    if (!cmd.resto_telephone && (telNorm || telBrut)) patchResto.resto_telephone = telNorm ?? telBrut;
    await restFetch(
      sb,
      `commandes?id=eq.${enc(cmd.id)}`,
      { method: 'PATCH', body: JSON.stringify(patchResto) },
      { 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    ).catch(() => {});

    return json({
      ok: true,
      resto_notifie_at: now,
      emailStatut,
      telephone: telNorm ?? (telBrut || null),
      whatsappUrl: telNorm ? `https://wa.me/${telNorm}?text=${encodeURIComponent(texteResto)}` : null,
      texteResto,
    });
  }

  return err(404, 'Section admin introuvable.');
}
