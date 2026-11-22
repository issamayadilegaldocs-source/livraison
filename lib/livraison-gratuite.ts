// Livraison gratuite offerte par le livreur : toujours, ou dès un panier minimum. Le client ne paie pas la livraison ;
// le livreur la prend à sa charge (son gain ne l'inclut plus). Pur : Function (fait foi) et navigateur (aperçu).
import { z } from 'zod';

export const LivraisonGratuiteSchema = z.object({ min: z.number().positive().max(1000).optional() });
export type LivraisonGratuite = z.infer<typeof LivraisonGratuiteSchema>;

/** `panierMil` = plats du panier avant promo (millimes) : une promo ne fait pas perdre la livraison gratuite. Sans réglage : jamais gratuite. */
export const livraisonOfferte = (conf: LivraisonGratuite | null | undefined, panierMil: number): boolean =>
  Boolean(conf) && (conf!.min === undefined || panierMil >= Math.round(conf!.min * 1000));

/** « Livraison gratuite » ou « Livraison gratuite dès 30 DT » (mots traduits par l'appelant). */
export const texteLivraisonGratuite = (conf: LivraisonGratuite, mots: { gratuite: string; des: string }) =>
  conf.min ? `${mots.gratuite} ${mots.des} ${String(Math.round(conf.min * 100) / 100).replace('.', ',')} DT` : mots.gratuite;
