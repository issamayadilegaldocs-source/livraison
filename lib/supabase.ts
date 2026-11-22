// Couche de stockage du backend (Pages Functions) : Supabase (Postgres + Storage) ou R2 en secours.
// Pur Web Standards (`fetch`, aucun module Node) : tourne sur Cloudflare Pages Functions et dans vitest.
//
// Sécurité : le backend s'authentifie côté serveur avec `SUPABASE_SECRET_KEY` (`sb_secret_…`, ou l'ancienne
// clé `SUPABASE_SERVICE_ROLE_KEY`). Toutes les tables ont RLS activé sans politique publique, donc la clé
// publique (`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`) ne peut jamais lire ni modifier les données.
import { ConfigSchema, lireConfig, type Config } from './config';
import { changerStatut, cleFiche, lireFiche, prefixeFiches, type Fiche, type Statut } from './historique';
import { endpointValide } from './push';

/** Le sous-ensemble de l'API R2 utilisé par le backend (facile à simuler dans les tests). */
export type SeauR2 = {
  head(cle: string): Promise<unknown | null>;
  get(cle: string): Promise<{ body: ReadableStream } | null>;
  put(cle: string, valeur: Uint8Array | string, options?: { httpMetadata?: { contentType?: string } }): Promise<unknown>;
  delete(cle: string): Promise<unknown>;
  list(options: { prefix: string; limit?: number }): Promise<{ objects: { key: string }[] }>;
};

export type EnvStockage = {
  /** URL du projet Supabase (ex. https://xxxx.supabase.co). */
  SUPABASE_URL?: string;
  /** Alias accepté si l'URL est partagée avec Next.js. */
  NEXT_PUBLIC_SUPABASE_URL?: string;
  /** Clé secrète serveur Supabase (`sb_secret_…`). Ne jamais exposer au navigateur. */
  SUPABASE_SECRET_KEY?: string;
  /** Ancienne clé serveur JWT (`service_role`), acceptée pour compatibilité. */
  SUPABASE_SERVICE_ROLE_KEY?: string;
  /** Bucket R2 privé (utilisé si Supabase n'est pas configuré). */
  BONS?: SeauR2;
};

/** Opérations de persistance du backend, indépendantes du fournisseur (Supabase ou R2). */
export type Stockage = {
  lireConfig(whatsapp: string): Promise<Config>;
  ecrireConfig(whatsapp: string, config: Config): Promise<void>;
  enregistrerFiche(whatsapp: string, fiche: Fiche): Promise<void>;
  lireFiches(whatsapp: string, limit: number): Promise<Fiche[]>;
  majStatutFiche(whatsapp: string, id: string, statut: Statut, maintenant: Date): Promise<boolean>;
  nbUsagesCoupon(whatsapp: string, code: string, plafond: number): Promise<number>;
  enregistrerUsageCoupon(whatsapp: string, code: string, ref: string): Promise<void>;
  lireAbonnementsPush(whatsapp: string): Promise<string[]>;
  ajouterAbonnementPush(whatsapp: string, endpoint: string, maxAppareils: number): Promise<void>;
  retirerAbonnementsPush(whatsapp: string, expires: string[]): Promise<void>;
  enregistrerBon(id: string, png: Uint8Array): Promise<void>;
  lireBon(id: string): Promise<ReadableStream | null>;
};

const enc = encodeURIComponent;

/**
 * En-têtes d'authentification Supabase :
 * - Nouvelle clé secrète opaque (`sb_secret_…`) : envoyée uniquement dans `apikey` (Kong la convertit en JWT service_role).
 * - Ancienne clé JWT (`service_role`) : envoyée dans `apikey` et `Authorization: Bearer …`.
 */
export function headersSupabase(cle: string, extra: Record<string, string> = {}): Record<string, string> {
  return {
    apikey: cle,
    ...(cle.startsWith('sb_') ? {} : { Authorization: `Bearer ${cle}` }),
    ...extra,
  };
}

type LigneCommande = {
  id: string;
  type: 'repas' | 'colis';
  creee: string;
  statut: Statut;
  fin: string | null;
  ref: string;
  titre: string;
  lignes: unknown;
  client_nom: string;
  client_telephone: string;
  adresse: string;
  note: string | null;
  total: number | string;
  html: string | null;
};

function ligneEnFiche(row: LigneCommande): Fiche | null {
  return lireFiche({
    id: row.id,
    type: row.type,
    creee: row.creee,
    statut: row.statut,
    ...(row.fin ? { fin: row.fin } : {}),
    ref: row.ref,
    titre: row.titre,
    lignes: row.lignes,
    client: { nom: row.client_nom, telephone: row.client_telephone },
    adresse: row.adresse,
    ...(row.note ? { note: row.note } : {}),
    total: Number(row.total),
    ...(row.html ? { html: row.html } : {}),
  });
}

/** Implémentation Supabase (PostgREST + Storage bucket privé `bons`). */
export function stockageSupabase(url: string, cle: string): Stockage {
  const base = url.replace(/\/+$/, '');
  const rest = (chemin: string, init: RequestInit = {}, extraHeaders: Record<string, string> = {}) =>
    fetch(`${base}/rest/v1/${chemin}`, {
      ...init,
      headers: headersSupabase(cle, { Accept: 'application/json', ...extraHeaders }),
    });

  return {
    async lireConfig(whatsapp) {
      const res = await rest(`livreur_configs?livreur_whatsapp=eq.${enc(whatsapp)}&select=config&limit=1`);
      if (!res.ok) {
        console.error('[supabase] lireConfig', res.status);
        return lireConfig(null);
      }
      const rows = (await res.json().catch(() => [])) as { config?: unknown }[];
      return lireConfig(rows[0]?.config ?? null);
    },

    async ecrireConfig(whatsapp, config) {
      const valide = ConfigSchema.parse(config);
      const res = await rest(
        'livreur_configs?on_conflict=livreur_whatsapp',
        {
          method: 'POST',
          body: JSON.stringify({ livreur_whatsapp: whatsapp, config: valide, updated_at: new Date().toISOString() }),
        },
        { 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
      );
      if (!res.ok) throw new Error(`[supabase] ecrireConfig ${res.status}`);
    },

    async enregistrerFiche(whatsapp, f) {
      const res = await rest(
        'commandes?on_conflict=livreur_whatsapp,id',
        {
          method: 'POST',
          body: JSON.stringify({
            id: f.id,
            livreur_whatsapp: whatsapp,
            type: f.type,
            ref: f.ref,
            statut: f.statut,
            creee: f.creee,
            fin: f.fin ?? null,
            titre: f.titre,
            lignes: f.lignes,
            client_nom: f.client.nom,
            client_telephone: f.client.telephone,
            adresse: f.adresse,
            note: f.note ?? null,
            total: f.total,
            html: f.html ?? null,
          }),
        },
        { 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
      );
      if (!res.ok) throw new Error(`[supabase] enregistrerFiche ${res.status}`);
    },

    async lireFiches(whatsapp, limit) {
      const res = await rest(
        `commandes?livreur_whatsapp=eq.${enc(whatsapp)}&select=id,type,creee,statut,fin,ref,titre,lignes,client_nom,client_telephone,adresse,note,total,html&order=creee.desc,id.asc&limit=${limit}`,
      );
      if (!res.ok) throw new Error(`[supabase] lireFiches ${res.status}`);
      const rows = (await res.json()) as LigneCommande[];
      return rows.map(ligneEnFiche).filter((f): f is Fiche => f !== null);
    },

    async majStatutFiche(whatsapp, id, statut, maintenant) {
      const res = await rest(
        `commandes?livreur_whatsapp=eq.${enc(whatsapp)}&id=eq.${enc(id)}&select=id`,
        {
          method: 'PATCH',
          body: JSON.stringify({ statut, fin: statut === 'nouvelle' ? null : maintenant.toISOString() }),
        },
        { 'Content-Type': 'application/json', Prefer: 'return=representation' },
      );
      if (!res.ok) throw new Error(`[supabase] majStatutFiche ${res.status}`);
      const rows = (await res.json()) as { id: string }[];
      return rows.length > 0;
    },

    async nbUsagesCoupon(whatsapp, code, plafond) {
      const res = await rest(
        `coupon_usages?livreur_whatsapp=eq.${enc(whatsapp)}&code=eq.${enc(code)}&select=commande_ref&limit=${plafond + 1}`,
      );
      if (!res.ok) {
        console.error('[supabase] nbUsagesCoupon', res.status);
        return 0;
      }
      const rows = (await res.json().catch(() => [])) as unknown[];
      return rows.length;
    },

    async enregistrerUsageCoupon(whatsapp, code, ref) {
      const res = await rest(
        'coupon_usages?on_conflict=livreur_whatsapp,code,commande_ref',
        {
          method: 'POST',
          body: JSON.stringify({ livreur_whatsapp: whatsapp, code, commande_ref: ref }),
        },
        { 'Content-Type': 'application/json', Prefer: 'resolution=ignore-duplicates,return=minimal' },
      );
      if (!res.ok) console.error('[supabase] enregistrerUsageCoupon', res.status);
    },

    async lireAbonnementsPush(whatsapp) {
      const res = await rest(
        `push_subscriptions?livreur_whatsapp=eq.${enc(whatsapp)}&select=endpoint&order=updated_at.asc`,
      );
      if (!res.ok) {
        console.error('[supabase] lireAbonnementsPush', res.status);
        return [];
      }
      const rows = (await res.json().catch(() => [])) as { endpoint?: unknown }[];
      return rows.map((r) => r.endpoint).filter(endpointValide);
    },

    async ajouterAbonnementPush(whatsapp, endpoint, maxAppareils) {
      const res = await rest(
        'push_subscriptions?on_conflict=livreur_whatsapp,endpoint',
        {
          method: 'POST',
          body: JSON.stringify({ livreur_whatsapp: whatsapp, endpoint, updated_at: new Date().toISOString() }),
        },
        { 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
      );
      if (!res.ok) throw new Error(`[supabase] ajouterAbonnementPush ${res.status}`);
      // Conserve uniquement les `maxAppareils` abonnements les plus récents.
      const listeRes = await rest(
        `push_subscriptions?livreur_whatsapp=eq.${enc(whatsapp)}&select=endpoint&order=updated_at.desc`,
      );
      if (!listeRes.ok) return;
      const rows = (await listeRes.json().catch(() => [])) as { endpoint: string }[];
      const enTrop = rows.slice(maxAppareils).map((r) => r.endpoint);
      if (enTrop.length) await this.retirerAbonnementsPush(whatsapp, enTrop);
    },

    async retirerAbonnementsPush(whatsapp, expires) {
      await Promise.all(
        expires.map((ep) =>
          rest(`push_subscriptions?livreur_whatsapp=eq.${enc(whatsapp)}&endpoint=eq.${enc(ep)}`, { method: 'DELETE' }),
        ),
      );
    },

    async enregistrerBon(id, png) {
      const res = await fetch(`${base}/storage/v1/object/bons/${enc(id)}.png`, {
        method: 'POST',
        headers: headersSupabase(cle, {
          'Content-Type': 'image/png',
          'x-upsert': 'false',
          'cache-control': '604800',
        }),
        body: png as BodyInit,
      });
      if (res.ok || res.status === 409) return;
      // Anciennes versions de Supabase Storage renvoient 400 avec "Duplicate" / "Already Exists" si le fichier existe déjà.
      if (res.status === 400) {
        const txt = await res.text().catch(() => '');
        if (/duplicate|already exists|"409"/i.test(txt)) return;
        throw new Error(`[supabase] enregistrerBon 400: ${txt}`);
      }
      throw new Error(`[supabase] enregistrerBon ${res.status}`);
    },

    async lireBon(id) {
      const res = await fetch(`${base}/storage/v1/object/bons/${enc(id)}.png`, {
        headers: headersSupabase(cle),
      });
      if (!res.ok || !res.body) return null;
      return res.body;
    },
  };
}

const cleBon = (id: string) => `bons/${id}.png`;
const cleConfig = (whatsapp: string) => `config/${whatsapp}.json`;
const prefixeUsage = (whatsapp: string, code: string) => `usages/${whatsapp}/${code}/`;
const cleAbonnements = (whatsapp: string) => `push/${whatsapp}.json`;

/** Implémentation R2 (Cloudflare bucket `BONS`), conservée par défaut quand Supabase n'est pas configuré. */
export function stockageR2(seau: SeauR2): Stockage {
  return {
    async lireConfig(whatsapp) {
      const objet = await seau.get(cleConfig(whatsapp));
      if (!objet) return lireConfig(null);
      return lireConfig(await new Response(objet.body).json().catch(() => null));
    },

    async ecrireConfig(whatsapp, config) {
      await seau.put(cleConfig(whatsapp), JSON.stringify(ConfigSchema.parse(config)), {
        httpMetadata: { contentType: 'application/json' },
      });
    },

    async enregistrerFiche(whatsapp, f) {
      await seau.put(cleFiche(whatsapp, f.id), JSON.stringify(f), {
        httpMetadata: { contentType: 'application/json' },
      });
    },

    async lireFiches(whatsapp, limit) {
      const { objects } = await seau.list({ prefix: prefixeFiches(whatsapp), limit });
      const lues = await Promise.all(
        objects.map(async (o) => {
          const obj = await seau.get(o.key);
          return obj ? lireFiche(await new Response(obj.body).json().catch(() => null)) : null;
        }),
      );
      return lues.filter((f): f is Fiche => f !== null);
    },

    async majStatutFiche(whatsapp, id, statut, maintenant) {
      const objet = await seau.get(cleFiche(whatsapp, id));
      const fiche = objet ? lireFiche(await new Response(objet.body).json().catch(() => null)) : null;
      if (!fiche) return false;
      await seau.put(cleFiche(whatsapp, id), JSON.stringify(changerStatut(fiche, statut, maintenant)), {
        httpMetadata: { contentType: 'application/json' },
      });
      return true;
    },

    async nbUsagesCoupon(whatsapp, code, plafond) {
      return (await seau.list({ prefix: prefixeUsage(whatsapp, code), limit: plafond + 1 })).objects.length;
    },

    async enregistrerUsageCoupon(whatsapp, code, ref) {
      await seau.put(`${prefixeUsage(whatsapp, code)}${ref}`, '1');
    },

    async lireAbonnementsPush(whatsapp) {
      const o = await seau.get(cleAbonnements(whatsapp));
      if (!o) return [];
      try {
        const l: unknown = JSON.parse(await new Response(o.body).text());
        return Array.isArray(l) ? l.filter(endpointValide) : [];
      } catch {
        return [];
      }
    },

    async ajouterAbonnementPush(whatsapp, endpoint, maxAppareils) {
      const liste = (await this.lireAbonnementsPush(whatsapp)).filter((e) => e !== endpoint);
      await seau.put(cleAbonnements(whatsapp), JSON.stringify([...liste, endpoint].slice(-maxAppareils)));
    },

    async retirerAbonnementsPush(whatsapp, expires) {
      const liste = await this.lireAbonnementsPush(whatsapp);
      await seau.put(cleAbonnements(whatsapp), JSON.stringify(liste.filter((e) => !expires.includes(e))));
    },

    async enregistrerBon(id, png) {
      if (await seau.head(cleBon(id))) return;
      await seau.put(cleBon(id), png, { httpMetadata: { contentType: 'image/png' } });
    },

    async lireBon(id) {
      const objet = await seau.get(cleBon(id));
      return objet ? objet.body : null;
    },
  };
}

/**
 * Résout le stockage actif à partir des variables d'environnement :
 * 1. Supabase si `SUPABASE_URL` (ou `NEXT_PUBLIC_SUPABASE_URL`) ET `SUPABASE_SECRET_KEY` (ou `SUPABASE_SERVICE_ROLE_KEY`) sont définis.
 * 2. Sinon le bucket R2 `BONS`.
 */
export function stockage(env: EnvStockage): Stockage | null {
  const url = (env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL || '').trim();
  const cle = (env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  if (url && cle) return stockageSupabase(url, cle);
  if (env.BONS) return stockageR2(env.BONS);
  return null;
}
