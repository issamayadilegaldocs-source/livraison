// Petites règles de gestion du livreur (page de config) : supplément de livraison (pluie, nuit…), montants de pourboire
// proposés, commande minimum, message d'annonce, restos fermés. Pur : Function (fait foi) et navigateur (aperçu).
import { z } from 'zod';

const HEURE = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Supplément sur la livraison : un bouton manuel (pluie, rush…) et/ou automatique la nuit. */
export const SupplementSchema = z.object({
  manuel: z.object({ actif: z.boolean(), montant: z.number().positive().max(50), libelle: z.string().trim().min(1).max(30) }).optional(),
  nuit: z.object({ actif: z.boolean(), de: z.string().regex(HEURE), a: z.string().regex(HEURE), montant: z.number().positive().max(50) }).optional(),
});
export type Supplement = z.infer<typeof SupplementSchema>;

export const PourboiresSchema = z.array(z.number().positive().max(50)).min(1).max(6);
export const POURBOIRES_DEFAUT = [1, 2, 3, 5];

export const AnnonceSchema = z.string().trim().min(1).max(140);

export const minutes = (h: string) => {
  const [a, b] = h.split(':').map(Number);
  return a * 60 + b;
};

/** Heure de Tunis (UTC+1 toute l'année) en minutes depuis minuit : la même sur le serveur et dans le navigateur. */
export const minutesTunis = (d: Date) => {
  const t = new Date(d.getTime() + 3600e3);
  return t.getUTCHours() * 60 + t.getUTCMinutes();
};

/** `m` (minutes depuis minuit) est-il entre `de` et `a` ? `de` > `a` : la fenêtre passe minuit (ex. 22:00 → 06:00). */
export const dansFenetre = (m: number, de: string, a: string): boolean => {
  const d = minutes(de);
  const f = minutes(a);
  return d === f ? false : d < f ? m >= d && m < f : m >= d || m < f;
};

/** Le supplément à appliquer maintenant (manuel actif + nuit si l'heure y est), ou null. `nomNuit` : mot traduit. */
export function supplementEnCours(conf: Supplement | null | undefined, maintenant: Date, nomNuit = 'Nuit'): { montant: number; libelle: string } | null {
  if (!conf) return null;
  let total = 0;
  const noms: string[] = [];
  if (conf.manuel?.actif) {
    total += conf.manuel.montant;
    noms.push(conf.manuel.libelle);
  }
  if (conf.nuit?.actif) {
    if (dansFenetre(minutesTunis(maintenant), conf.nuit.de, conf.nuit.a)) {
      total += conf.nuit.montant;
      noms.push(nomNuit);
    }
  }
  return total > 0 ? { montant: Math.round(total * 1000) / 1000, libelle: noms.join(' + ') } : null;
}
