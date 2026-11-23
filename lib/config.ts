// Réglages modifiables par le livreur depuis sa page de config (lien secret /api/config?cle=…), sans redéploiement.
// Stockés dans R2 (`config/<whatsapp>.json`), ils remplacent ceux de livreur.json : pause (avec heure de retour),
// horaires, frais, prix ou disponibilité des plats. La majoration (marge du livreur) et l'identité du site
// (nom, couleurs, contacts) restent dans livreur.json, réglées par le propriétaire.
// Pur : utilisé par la Function (qui fait foi) et par le navigateur (affichage).
import { z } from 'zod';
import type { Plat } from './catalogue';
import { ColisConfSchema, tarifColis, type TarifColis } from './colis';
import { CommissionSchema, PromoSchema, type Commission, type Promo } from './commission';
import { FraisServiceSchema, type FraisService } from './frais-service';
import { LivraisonGratuiteSchema, type LivraisonGratuite } from './livraison-gratuite';
import { AnnonceSchema, POURBOIRES_DEFAUT, PourboiresSchema, SupplementSchema, type Supplement } from './regles-livreur';
import type { ConfLivraison } from './livraison';
import type { Livreur } from './livreur';
import type { Service } from './service';

const HEURE = /^([01]\d|2[0-3]):[0-5]\d$/;
/** Date-heure locale de Tunis, format d'un <input type="datetime-local"> : 2026-11-18T14:30. */
const DATE_HEURE = /^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d$/;

export const ServiceSchema = z
  .object({ ouvre: z.string().regex(HEURE), ferme: z.string().regex(HEURE) })
  .refine((s) => s.ouvre !== s.ferme, 'ouvre et ferme doivent différer');

export const FraisSchema = z
  .object({
    base: z.number().min(0).max(50),
    parKm: z.number().min(0).max(20),
    min: z.number().min(0).max(100),
    max: z.number().positive().max(200),
    rayonMaxKm: z.number().positive().max(60),
  })
  .refine((f) => f.min <= f.max, 'le minimum doit être ≤ au maximum');

/**
 * Correction d'un plat par le livreur : `prix` = prix payé par le CLIENT ; `resto` = nouveau prix demandé par le RESTO
 * (le menu importé est périmé) ; et/ou indisponible. Sans `prix`, le client paie le nouveau prix du resto + la majoration.
 */
export const CorrectionSchema = z.object({ prix: z.number().positive().max(1000).optional(), resto: z.number().positive().max(1000).optional(), indispo: z.literal(true).optional() });
export type Correction = z.infer<typeof CorrectionSchema>;

/** Une règle : `montant` DT ajoutés au prix du plat, ou `pourcent` sur le plat et ses suppléments. */
export const RegleSchema = z.union([
  z.object({ montant: z.number().positive().max(100) }).strict(),
  z.object({ pourcent: z.number().positive().max(100) }).strict(),
]);
export type Regle = z.infer<typeof RegleSchema>;

/** Règles du plus général au plus précis : la règle du plat l'emporte sur celle du resto, qui l'emporte sur `tous`. */
export const MajorationSchema = z
  .object({ tous: RegleSchema.optional(), restos: z.record(z.string(), RegleSchema).optional(), plats: z.record(z.string(), RegleSchema).optional() })
  .strict();
export type Majoration = z.infer<typeof MajorationSchema>;

export const ConfigSchema = z.object({
  pause: z.boolean().default(false),
  // Heure de retour annoncée aux clients ; la pause s'arrête toute seule à cette heure.
  retour: z.string().regex(DATE_HEURE).optional(),
  // absent : horaires de livreur.json ; null : aucun horaire (toujours en service) ; objet : ces horaires.
  service: ServiceSchema.nullable().optional(),
  frais: FraisSchema.optional(),
  // absent : livreur.json ; null : aucun frais de service ; objet : ces frais.
  fraisService: FraisServiceSchema.nullable().optional(),
  // absent : livreur.json ; null : livraison payante ; objet : livraison gratuite (avec panier minimum éventuel).
  livraisonGratuite: LivraisonGratuiteSchema.nullable().optional(),
  // absent : livreur.json (ou mêmes frais que les repas) ; objet : tarif colis du livreur.
  colis: ColisConfSchema.optional(),
  // Petites règles du livreur (config seulement) : restos fermés, commande minimum, supplément, annonce, pourboires.
  restosFermes: z.array(z.string().regex(/^[a-z0-9-]{1,80}$/)).max(500).default([]),
  commandeMin: z.number().positive().max(1000).optional(),
  supplement: SupplementSchema.optional(),
  annonce: AnnonceSchema.optional(),
  pourboires: PourboiresSchema.optional(),
  // absent : livreur.json ; objet / liste : ceux-ci (liste vide = plus de promo).
  commission: CommissionSchema.optional(),
  promos: z.array(PromoSchema).max(50).optional(),
  // absent : livreur.json ; null : aucune majoration ; objet : majoration live (marge livreur).
  majoration: MajorationSchema.nullable().optional(),
  // absent : livreur.json ; null : logo générique ; string : URL du logo personnalisé (upload ou lien).
  logoUrl: z.string().trim().max(500).nullable().optional(),
  // absent : livreur.json ; null : nom par défaut ; string : nom affiché du site (en-tête, pied de page, admin).
  nomSite: z.string().trim().min(1).max(60).nullable().optional(),
  // Programme de parrainage client (code + crédit parrain/filleul)
  parrainage: z
    .object({
      actif: z.boolean().default(true),
      montantParrain: z.number().min(0).max(50).default(3),
      montantFilleul: z.number().min(0).max(50).default(3),
    })
    .optional(),
  // Moyens de paiement proposés aux clients
  paiements: z
    .object({
      especes: z.boolean().default(true),
      flouciD17: z.boolean().default(false),
      carteTpe: z.boolean().default(false),
      numeroD17: z.string().trim().max(40).optional(),
    })
    .optional(),
  // restoSlug → platId → correction
  plats: z.record(z.string(), z.record(z.string(), CorrectionSchema)).default({}),
});
export type Config = z.infer<typeof ConfigSchema>;

export const CONFIG_VIDE: Config = { pause: false, plats: {}, restosFermes: [] };

/** Config lue dans R2 : invalide ou absente → config vide (le site reste sur livreur.json). */
export function lireConfig(brut: unknown): Config {
  const r = ConfigSchema.safeParse(brut ?? {});
  return r.success ? r.data : CONFIG_VIDE;
}

/** Tunis = UTC+1 toute l'année (pas d'heure d'été). */
export const dateTunis = (dateHeure: string) => new Date(`${dateHeure}:00+01:00`);

/** La pause est-elle en cours ? Elle s'arrête d'elle-même à l'heure de retour annoncée. */
export function pauseEnCours(c: Pick<Config, 'pause' | 'retour'>, maintenant: Date): boolean {
  return c.pause && !(c.retour && dateTunis(c.retour) <= maintenant);
}

/** Horaires et frais en vigueur : ceux du livreur (page de config) sinon ceux de livreur.json. */
export function reglages(livreur: Livreur, c: Config): { service: Service | undefined; livraison: ConfLivraison; fraisService: FraisService | null; livraisonGratuite: LivraisonGratuite | null; colis: TarifColis; restosFermes: string[]; commandeMin: number | null; supplement: Supplement | null; annonce: string | null; pourboires: number[]; commission: Commission | undefined; promos: Promo[]; majoration: Majoration | undefined; logoUrl: string | null; nomSite: string; parrainage: { actif: boolean; montantParrain: number; montantFilleul: number }; paiements: { especes: boolean; flouciD17: boolean; carteTpe: boolean; numeroD17?: string } } {
  return {
    service: c.service === undefined ? livreur.service : (c.service ?? undefined),
    livraison: c.frais ? { ...livreur.livraison, ...c.frais } : livreur.livraison,
    fraisService: c.fraisService === undefined ? (livreur.fraisService ?? null) : c.fraisService,
    livraisonGratuite: c.livraisonGratuite === undefined ? (livreur.livraisonGratuite ?? null) : c.livraisonGratuite,
    colis: tarifColis(c.frais ? { ...livreur.livraison, ...c.frais } : livreur.livraison, c.colis ?? livreur.colis),
    restosFermes: c.restosFermes,
    commandeMin: c.commandeMin ?? null,
    supplement: c.supplement ?? null,
    annonce: c.annonce ?? null,
    pourboires: c.pourboires ?? POURBOIRES_DEFAUT,
    commission: c.commission ?? livreur.commission,
    promos: (c.promos ?? livreur.promos ?? []).filter((p) => p.actif),
    majoration: c.majoration === undefined ? livreur.majoration : (c.majoration ?? undefined),
    logoUrl: c.logoUrl === undefined ? (livreur.logo ?? null) : c.logoUrl,
    nomSite: c.nomSite?.trim() || livreur.nom,
    parrainage: c.parrainage ?? { actif: true, montantParrain: 3, montantFilleul: 3 },
    paiements: c.paiements ?? { especes: true, flouciD17: false, carteTpe: false },
  };
}

// --- Majoration (marge du livreur) ---------------------------------------------------------------

export function regleDuPlat(m: Majoration | undefined, restoSlug: string, platId: number): Regle | undefined {
  return m?.plats?.[platId] ?? m?.restos?.[restoSlug] ?? m?.tous;
}

/** Pourcentage arrondi aux 100 millimes supérieurs. */
export function majorer(prix: number, pourcent: number): number {
  if (!pourcent) return prix;
  return Math.ceil(Math.round(prix * (100 + pourcent) * 10) / 100 - 1e-9) / 10;
}

const plusMontant = (prix: number, montant: number) => Math.round((prix + montant) * 1000) / 1000;

type PlatPrix = Pick<Plat, 'id' | 'prix' | 'prixOrigine' | 'groupes' | 'prixResto'>;

/**
 * Prix payés par le client : prix du resto + majoration, ou le prix fixé par le livreur (alors sans règle de majoration).
 * Garde le prix du resto dans `prixResto` (plat et suppléments) pour l'email du livreur et le bon du resto.
 * Retire les plats indisponibles. À appliquer sur les prix bruts du dump (build, Function), une seule fois.
 */
export function prixClients<P extends PlatPrix>(plats: P[], m: Majoration | undefined, restoSlug: string, corrections?: Record<string, Correction>): P[] {
  return plats
    .filter((p) => !corrections?.[p.id]?.indispo)
    .map((p) => {
      const corrige = corrections?.[p.id]?.prix;
      // Prix du resto : celui que le livreur a corrigé, sinon celui du menu importé.
      const base = corrections?.[p.id]?.resto ?? p.prixResto ?? p.prix;
      const r = regleDuPlat(m, restoSlug, p.id);
      const plat = (x: number) => (!r ? x : 'montant' in r ? plusMontant(x, r.montant) : majorer(x, r.pourcent));
      const supplement = (x: number) => (r && 'pourcent' in r && x ? majorer(x, r.pourcent) : x);
      // Prix barré : le prix d'origine du resto, majoré pareil ; sans objet si le livreur a fixé le prix.
      const origine = corrige !== undefined || corrections?.[p.id]?.resto !== undefined || p.prixOrigine === null ? null : plat(p.prixOrigine);
      return {
        ...p,
        prix: corrige ?? plat(base),
        prixResto: base,
        prixOrigine: origine,
        groupes: p.groupes.map((g) => ({
          ...g,
          options: g.options.map((o) => {
            const prixResto = o.prixResto ?? o.prix;
            return { ...o, prix: supplement(prixResto), prixResto };
          }),
        })),
      };
    });
}

/**
 * Corrections du livreur vues par le navigateur (/api/etat) : toujours en prix CLIENT, jamais le prix du resto ni les
 * règles de majoration. Un nouveau prix du resto sans prix client fixé devient resto + majoration.
 */
export function correctionsClient(m: Majoration | undefined, restoSlug: string, corrections: Record<string, Correction> | undefined): Record<string, Correction> {
  const out: Record<string, Correction> = {};
  for (const [id, c] of Object.entries(corrections ?? {})) {
    if (c.indispo) out[id] = { indispo: true };
    else if (c.prix !== undefined) out[id] = { prix: c.prix };
    else if (c.resto !== undefined) {
      const r = regleDuPlat(m, restoSlug, Number(id));
      out[id] = { prix: !r ? c.resto : 'montant' in r ? plusMontant(c.resto, r.montant) : majorer(c.resto, r.pourcent) };
    }
  }
  return out;
}

/** Navigateur : applique les corrections déjà en prix client (/api/etat) aux plats de la page. */
export function corrigerPlats<P extends Pick<Plat, 'id' | 'prix' | 'prixOrigine'>>(plats: P[], corrections: Record<string, Correction> | undefined): P[] {
  if (!corrections || !Object.keys(corrections).length) return plats;
  return plats
    .filter((p) => !corrections[p.id]?.indispo)
    .map((p) => {
      const prix = corrections[p.id]?.prix;
      return prix === undefined ? p : { ...p, prix, prixOrigine: null };
    });
}
