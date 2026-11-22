// Commission du livreur sur les restos (comme Hamma : un % du prix du resto, pris sur la part du resto, pour le
// livreur) et promos financées par le resto, le livreur ou les deux. Pur : Function (fait foi) et navigateur (remise).
import { z } from 'zod';

const Pct = z.number().min(0).max(100);

/** Un seul niveau : un % par resto. (Les anciens réglages « tous », « menu » et « plat » sont ignorés à la lecture.) */
export const CommissionSchema = z.object({
  restos: z.record(z.string(), Pct).default({}),
});
export type Commission = z.infer<typeof CommissionSchema>;

export const pourcentCommission = (c: Commission | undefined, resto: string): number => c?.restos[resto] ?? 0;

/** Commission d'une ligne, en millimes (prix du resto de la ligne × %). */
export const commissionMil = (ligneRestoMil: number, pct: number) => Math.round((ligneRestoMil * pct) / 100);

// --- Promos ----------------------------------------------------------------------------------------------

export const PromoSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9]{4,12}$/),
    nom: z.string().trim().min(1).max(60),
    type: z.enum(['pourcent', 'montant']),
    valeur: z.number().positive().max(1000),
    /** Plafond de la remise d'une promo en %. */
    max: z.number().positive().max(1000).optional(),
    /** Panier minimum (plats, prix client). */
    min: z.number().positive().max(1000).optional(),
    /** Un seul resto (slug) ; absent = tous les restos. */
    resto: z.string().regex(/^[a-z0-9-]{1,80}$/).optional(),
    /** Code coupon : la promo ne s'applique que si le client le tape dans son panier (sans code : automatique). */
    code: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9]{3,20}$/)
      .optional(),
    /** Un seul plat (id) de ce resto : la remise ne porte que sur ce plat. Demande `resto`. */
    plat: z.number().int().positive().optional(),
    /** Qui paie la remise : le livreur, le resto, ou les deux (le resto paie `partResto` %). */
    financeur: z.enum(['livreur', 'resto', 'partage']),
    partResto: z.number().int().min(1).max(99).optional(),
    actif: z.boolean().default(true),
    /** Coupon seulement : s'ajoute à la meilleure promo automatique au lieu de la remplacer. */
    cumulable: z.boolean().optional(),
    /** Coupon seulement : nombre maximum d'utilisations (commandes passées avec ce code). */
    limite: z.number().int().min(1).max(100000).optional(),
  })
  .refine((p) => p.type !== 'pourcent' || p.valeur <= 100, 'un pourcentage ne dépasse pas 100')
  .refine((p) => p.plat === undefined || p.resto !== undefined, 'une promo sur un plat indique son resto')
  .refine((p) => (!p.cumulable && p.limite === undefined) || p.code !== undefined, 'cumulable et limite ne vont qu’avec un code')
  .refine((p) => p.financeur !== 'partage' || p.partResto !== undefined, 'une promo partagée indique la part du resto');
export type Promo = z.infer<typeof PromoSchema>;

/** Ce que voit le client : jamais qui finance. */
export type PromoVue = Pick<Promo, 'id' | 'nom' | 'type' | 'valeur' | 'max' | 'min' | 'resto' | 'plat' | 'cumulable'>;

export const vueClient = ({ id, nom, type, valeur, max, min, resto, plat, cumulable }: Promo): PromoVue => ({ id, nom, type, valeur, max, min, resto, plat, cumulable });

/** Part du resto dans la remise, en % entier. */
export const partRestoPourcent = (p: Pick<Promo, 'financeur' | 'partResto'>) => (p.financeur === 'resto' ? 100 : p.financeur === 'partage' ? (p.partResto ?? 0) : 0);

/**
 * La meilleure promo applicable (une seule par commande) : active, bon resto, panier minimum atteint.
 * `panierMil` = plats au prix client, en millimes. `parPlatMil` = total des lignes de chaque plat (id → millimes) : une
 * promo sur un plat ne porte que sur ce plat (son minimum aussi). Remise ≤ sa base.
 */
export function meilleurePromo<P extends PromoVue>(promos: P[] | undefined, resto: string, panierMil: number, parPlatMil: Record<number, number> = {}): { promo: P; remiseMil: number } | null {
  let best: { promo: P; remiseMil: number } | null = null;
  for (const p of promos ?? []) {
    if (p.resto && p.resto !== resto) continue;
    const base = p.plat !== undefined ? (parPlatMil[p.plat] ?? 0) : panierMil;
    if (base <= 0 || (p.min !== undefined && base < Math.round(p.min * 1000))) continue;
    const brut = p.type === 'montant' ? Math.round(p.valeur * 1000) : Math.round((base * p.valeur) / 100);
    const plafonne = p.type === 'pourcent' && p.max !== undefined ? Math.min(brut, Math.round(p.max * 1000)) : brut;
    const remiseMil = Math.min(base, plafonne);
    if (remiseMil > 0 && (!best || remiseMil > best.remiseMil)) best = { promo: p, remiseMil };
  }
  return best;
}

/**
 * Les promos appliquées à une commande : le coupon seul s'il n'est pas cumulable, sinon le coupon + la meilleure promo
 * automatique (la 2e remise ne dépasse jamais ce qui reste du panier). Sans coupon : la meilleure promo automatique.
 */
export function promosAppliquees<P extends PromoVue>(coupon: P | null, autos: P[], resto: string, panierMil: number, parPlatMil: Record<number, number> = {}): { promo: P; remiseMil: number }[] {
  const c = coupon ? meilleurePromo([coupon], resto, panierMil, parPlatMil) : null;
  if (c && !c.promo.cumulable) return [c];
  const a = meilleurePromo(autos, resto, panierMil, parPlatMil);
  if (!c) return a ? [a] : [];
  if (!a) return [c];
  const reste = Math.min(a.remiseMil, panierMil - c.remiseMil);
  return reste > 0 ? [c, { promo: a.promo, remiseMil: reste }] : [c];
}

const nombreFr = (x: number) => String(Math.round(x * 100) / 100).replace('.', ',');
const texteRemise = (p: PromoVue, des: string) => `−${p.type === 'pourcent' ? `${nombreFr(p.valeur)} %` : `${nombreFr(p.valeur)} DT`}${p.min ? ` ${des} ${nombreFr(p.min)} DT` : ''}`;
const meilleur = (l: PromoVue[]) => {
  const score = (p: PromoVue) => (p.resto ? 1e6 : 0) + (p.type === 'pourcent' ? 1e3 : 0) + p.valeur;
  return [...l].sort((a, b) => score(b) - score(a))[0];
};

/**
 * La promo à afficher pour un resto (badge, bandeau) : celle de ce resto d'abord, sinon une promo générale ; en %
 * avant en DT, la plus forte d'abord. Les promos sur un plat ne comptent pas ici : s'il n'y a que celles-là, le
 * texte est `platsEnPromo`. Même si le panier minimum n'est pas atteint : c'est une annonce, la remise réelle est
 * calculée à la commande. `des` = le mot « dès » (traduit par l'appelant).
 */
export function etiquettePromo(promos: PromoVue[] | undefined, resto: string, des = 'dès', platsEnPromo = 'Plats en promo'): { nom: string; texte: string } | null {
  const ok = (promos ?? []).filter((p) => !p.resto || p.resto === resto);
  const duResto = ok.filter((p) => p.plat === undefined);
  if (duResto.length) {
    const p = meilleur(duResto);
    return { nom: p.nom, texte: texteRemise(p, des) };
  }
  return ok.length ? { nom: ok[0].nom, texte: platsEnPromo } : null;
}

/** Badge d'un plat : sa propre promo, sinon celle du resto (qui s'applique aussi à lui). */
export function etiquettePlat(promos: PromoVue[] | undefined, resto: string, platId: number, des = 'dès'): { nom: string; texte: string } | null {
  const propre = (promos ?? []).filter((p) => p.plat === platId && p.resto === resto);
  if (propre.length) return { nom: meilleur(propre).nom, texte: texteRemise(meilleur(propre), des) };
  const general = (promos ?? []).filter((p) => p.plat === undefined && (!p.resto || p.resto === resto));
  return general.length ? { nom: meilleur(general).nom, texte: texteRemise(meilleur(general), des) } : null;
}

/** Répartition de la remise (Hamma : `vendorShareOfDiscount`) : part du livreur = remise − part du resto. */
export function repartirRemise(remiseMil: number, pctResto: number, resteRestoMil: number): { restoMil: number; livreurMil: number } {
  // La part du resto ne dépasse pas ce qui lui reste (prix − commission) : l'excédent retombe sur le livreur.
  const restoMil = Math.min(Math.round((remiseMil * pctResto) / 100), Math.max(0, resteRestoMil));
  return { restoMil, livreurMil: remiseMil - restoMil };
}
