import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { MajorationSchema } from './config';
import { ColisConfSchema } from './colis';
import { CommissionSchema, PromoSchema } from './commission';
import { FraisServiceSchema } from './frais-service';
import { LivraisonGratuiteSchema } from './livraison-gratuite';

export const LivreurSchema = z.object({
  nom: z.string().min(1),
  slogan: z.string().min(1),
  logo: z.string().optional(),
  couleur: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'couleur : #RRGGBB'),
  whatsapp: z.string().regex(/^216\d{8}$/, 'whatsapp : 216 + 8 chiffres'),
  email: z.string().email(),
  ville: z.string().min(1),
  // Marge du livreur sur les plats : { tous?, restos?: {slug: règle}, plats?: {id: règle} }, règle = { montant } (DT
  // par plat) ou { pourcent } (plat + suppléments). Le plat l'emporte sur le resto, qui l'emporte sur `tous`.
  majoration: MajorationSchema.optional(),
  // Frais de service (en plus de la livraison, pour le livreur) : { pourcent, min, max }. Absent = aucun. Modifiable
  // par le livreur sur sa page de config.
  fraisService: FraisServiceSchema.optional(),
  // Tarif des colis, à part des repas : { base, parKm, min, max, rayonMaxKm, moyen, grand, actif }. Absent = mêmes frais que
  // les repas, sans supplément.
  colis: ColisConfSchema.optional(),
  // Livraison gratuite (à la charge du livreur) : {} = toujours, { min } = dès ce panier. Absent = livraison payante.
  livraisonGratuite: LivraisonGratuiteSchema.optional(),
  // Commission du livreur sur les restos (% du prix du resto, pour lui) et promos financées par lui, le resto ou les
  // deux. Valeurs de départ ; le livreur les règle sur sa page de config.
  commission: CommissionSchema.optional(),
  promos: z.array(PromoSchema).max(50).optional(),
  // Alerte Telegram gratuite : chatId du livreur (il écrit /start au bot), et `appel` (@pseudo ou +216…) pour un appel
  // vocal Telegram en plus du message. Le bot lui-même est un secret du projet (TELEGRAM_BOT_TOKEN).
  telegram: z.object({ chatId: z.string().regex(/^-?\d{5,20}$/, 'telegram.chatId : numéro'), appel: z.string().regex(/^(@\w{4,32}|\+\d{8,15})$/, 'telegram.appel : @pseudo ou +216…').optional() }).optional(),
  // Horaires de service du livreur (tous les jours, heure de Tunis). Absent = toujours en service.
  service: z
    .object({ ouvre: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'service.ouvre : HH:MM'), ferme: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'service.ferme : HH:MM') })
    .refine((s) => s.ouvre !== s.ferme, 'service : ouvre et ferme doivent différer')
    .optional(),
  // frais = base + parKm × (vol d'oiseau × facteurRoute), arrondi au 0,5 DT supérieur, borné [min, max]
  livraison: z
    .object({
      base: z.number().nonnegative(),
      parKm: z.number().nonnegative(),
      min: z.number().nonnegative(),
      max: z.number().positive(),
      rayonMaxKm: z.number().positive(),
      facteurRoute: z.number().min(1).max(3),
    })
    .refine((l) => l.min <= l.max, 'livraison.min doit être ≤ livraison.max'),
});

export type Livreur = z.infer<typeof LivreurSchema>;

/** Nom de dossier d'une ville : `Sfax` → `sfax`, `Médenine` → `medenine`. */
export const dossierVille = (ville: string) =>
  ville.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

let cache: Livreur | null = null;

/**
 * Le livreur de ce build : `.build/livreur.json`, copié depuis `clients/<CLIENT>/livreur.json` par
 * scripts/preparer.mjs (lancé par `npm run dev` et `npm run build`). `LIVREUR_FILE` le remplace (tests).
 * Lu au build uniquement (fs). Lève une erreur si invalide.
 */
export function getLivreur(): Livreur {
  cache ??= LivreurSchema.parse(JSON.parse(fs.readFileSync(path.resolve(process.env.LIVREUR_FILE || '.build/livreur.json'), 'utf8')));
  return cache;
}
