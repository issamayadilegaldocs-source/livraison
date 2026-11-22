// Frais de service (comme Zigzag) : pourcentage du panier, borné [min, max]. Ils s'ajoutent à la livraison et
// reviennent au livreur. Pur : partagé navigateur (aperçu) et Function (calcul qui fait foi).
import { z } from 'zod';

export const FraisServiceSchema = z
  .object({ pourcent: z.number().min(0).max(100), min: z.number().min(0).max(100), max: z.number().min(0).max(100) })
  .refine((f) => f.min <= f.max, 'le minimum doit être ≤ au maximum');
export type FraisService = z.infer<typeof FraisServiceSchema>;

/** Formule Zigzag (1 000 commandes réelles) : clamp(8 % × panier, 0,8, 5). Bouton « Mettre par défaut ». */
export const FRAIS_SERVICE_ZIGZAG: FraisService = { pourcent: 8, min: 0.8, max: 5 };

/** `panier` = plats payés par le client (hors livraison). Sans réglage : 0. Arrondi au millime. */
export function calculerFraisService(conf: FraisService | null | undefined, panier: number): number {
  if (!conf) return 0;
  const brut = Math.round(panier * conf.pourcent * 10) / 1000;
  return Math.round(Math.min(conf.max, Math.max(conf.min, brut)) * 1000) / 1000;
}
