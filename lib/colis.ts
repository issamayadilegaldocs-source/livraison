// Demande de livraison de colis : le client remplit /colis, la Function valide, estime le prix avec les frais
// du livreur et lui envoie un email pour qu'il appelle le client. Rien n'est confirmé au client avant cet appel.
// Pur : partagé par le formulaire (estimation affichée) et la Function (qui fait foi).
import { z } from 'zod';
import { afficherTel, formaterPrix, lienMaps, normaliserTelephone } from './commande';
import { calculerLivraison, type ConfLivraison, type Point } from './livraison';
import { dansFenetre, minutes, minutesTunis } from './regles-livreur';

export const TAILLES = { petit: 'Petit (enveloppe, clés)', moyen: 'Moyen (sac, boîte)', grand: 'Grand (carton ≤ 10 kg)' } as const;
export type Taille = keyof typeof TAILLES;

/**
 * Règle de tarif des colis, à part de la livraison des repas : son propre prix (départ + par km, borné) et un
 * supplément selon la taille. `actif` false = le livreur ne prend plus de colis. Absent = mêmes frais que les repas.
 */
export const ColisConfSchema = z
  .object({
    actif: z.boolean().default(true),
    base: z.number().min(0).max(50),
    parKm: z.number().min(0).max(20),
    min: z.number().min(0).max(100),
    max: z.number().positive().max(200),
    rayonMaxKm: z.number().positive().max(60),
    moyen: z.number().min(0).max(100).default(0),
    grand: z.number().min(0).max(100).default(0),
    /** Supplément « dès que possible » (pas d'heure choisie). */
    urgent: z.number().min(0).max(100).default(0),
    /** Supplément automatique la nuit, selon l'heure de ramassage (celle choisie, sinon maintenant). */
    nuit: z
      .object({ actif: z.boolean(), de: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/), a: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/), montant: z.number().positive().max(100) })
      .optional(),
  })
  .refine((c) => c.min <= c.max, 'le minimum doit être ≤ au maximum');
export type ColisConf = z.infer<typeof ColisConfSchema>;

/** Ce qui sert vraiment au calcul : frais de distance (`facteurRoute` reste celui du livreur) + suppléments de taille. */
export type TarifColis = { actif: boolean; livraison: ConfLivraison; supplements: Record<Taille, number>; urgent: number; nuit: { de: string; a: string; montant: number } | null };

export function tarifColis(livraisonRepas: ConfLivraison, colis: ColisConf | undefined): TarifColis {
  if (!colis) return { actif: true, livraison: livraisonRepas, supplements: { petit: 0, moyen: 0, grand: 0 }, urgent: 0, nuit: null };
  const { actif, moyen, grand, urgent, nuit, ...frais } = colis;
  return { actif, livraison: { ...livraisonRepas, ...frais }, supplements: { petit: 0, moyen, grand }, urgent, nuit: nuit?.actif ? { de: nuit.de, a: nuit.a, montant: nuit.montant } : null };
}

/** Les suppléments d'un colis : taille, « dès que possible » (pas d'heure choisie), nuit (heure de ramassage). */
export function supplementColis(tarif: TarifColis, taille: Taille, heure: string | undefined, maintenant: Date) {
  const urgent = heure ? 0 : tarif.urgent;
  const nuit = tarif.nuit && dansFenetre(heure ? minutes(heure) : minutesTunis(maintenant), tarif.nuit.de, tarif.nuit.a) ? tarif.nuit.montant : 0;
  const parTaille = tarif.supplements[taille];
  return { taille: parTaille, urgent, nuit, total: Math.round((parTaille + urgent + nuit) * 1000) / 1000 };
}

const PointSchema = z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) });
const Adresse = z.object({ adresse: z.string().trim().min(5).max(300), position: PointSchema });

export const ColisSchema = z.object({
  depart: Adresse,
  arrivee: Adresse,
  taille: z.enum(['petit', 'moyen', 'grand']),
  contenu: z.string().trim().min(2).max(120),
  client: z.object({ nom: z.string().trim().min(2).max(80), telephone: z.string().trim().min(8).max(20) }),
  destinataire: z.object({ nom: z.string().trim().max(80).optional(), telephone: z.string().trim().min(8).max(20) }),
  // « dès que possible », ou une heure HH:MM aujourd'hui
  heure: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
  note: z.string().trim().max(300).optional(),
});
export type ColisInput = z.input<typeof ColisSchema>;

export type ColisCalcule = {
  depart: { adresse: string; position: Point };
  arrivee: { adresse: string; position: Point };
  taille: Taille;
  contenu: string;
  client: { nom: string; telephone: string };
  destinataire: { nom?: string; telephone: string };
  heure?: string;
  note?: string;
  km: number;
  /** Prix estimé : frais de distance + supplément de taille. */
  frais: number;
  /** Part du prix due aux suppléments (taille, urgent, nuit). */
  supplement: number;
  supplements: { taille: number; urgent: number; nuit: number };
};

/** Valide les numéros et estime le prix avec le tarif colis du livreur. Erreur lisible sinon. */
export function calculerColis(tarif: TarifColis, input: z.infer<typeof ColisSchema>, maintenant: Date = new Date()): ColisCalcule | { erreur: string } {
  if (!tarif.actif) return { erreur: 'Les demandes de colis sont fermées pour le moment.' };
  const telClient = normaliserTelephone(input.client.telephone);
  if (!telClient) return { erreur: 'Votre numéro de téléphone est invalide (8 chiffres).' };
  const telDest = normaliserTelephone(input.destinataire.telephone);
  if (!telDest) return { erreur: 'Le numéro du destinataire est invalide (8 chiffres).' };
  const estimation = calculerLivraison(tarif.livraison, input.depart.position, input.arrivee.position);
  if ('erreur' in estimation) return { erreur: estimation.erreur.replace('de ce restaurant', 'du point de ramassage') };
  const sup = supplementColis(tarif, input.taille, input.heure, maintenant);
  return {
    ...input,
    client: { nom: input.client.nom, telephone: telClient },
    destinataire: { nom: input.destinataire.nom || undefined, telephone: telDest },
    note: input.note || undefined,
    km: estimation.km,
    frais: Math.round((estimation.frais + sup.total) * 1000) / 1000,
    supplement: sup.total,
    supplements: { taille: sup.taille, urgent: sup.urgent, nuit: sup.nuit },
  };
}

/** Texte brut de l'email au livreur. */
export function messageColis(c: ColisCalcule, ref: string, nomLivreur: string): string {
  return [
    `NOUVELLE DEMANDE DE COLIS N° ${ref} — ${nomLivreur}`,
    '',
    `À FAIRE : appeler le client ${c.client.nom} au ${afficherTel(c.client.telephone)}`,
    '',
    `Ramassage : ${c.depart.adresse}`,
    `Carte : ${lienMaps(c.depart.position)}`,
    '',
    `Livraison : ${c.arrivee.adresse}`,
    `Destinataire : ${c.destinataire.nom ? `${c.destinataire.nom}, ` : ''}${afficherTel(c.destinataire.telephone)}`,
    `Carte : ${lienMaps(c.arrivee.position)}`,
    '',
    `Colis : ${TAILLES[c.taille]} · ${c.contenu}`,
    `Quand : ${c.heure ? `à ${c.heure}` : 'dès que possible'}`,
    ...(c.note ? [`Note : ${c.note}`] : []),
    '',
    `Distance : ${String(c.km).replace('.', ',')} km · prix estimé ${formaterPrix(c.frais)}${c.supplement ? ` (distance ${formaterPrix(c.frais - c.supplement)}${[c.supplements.taille ? ` + taille ${formaterPrix(c.supplements.taille)}` : '', c.supplements.urgent ? ` + urgent ${formaterPrix(c.supplements.urgent)}` : '', c.supplements.nuit ? ` + nuit ${formaterPrix(c.supplements.nuit)}` : ''].join('')})` : ''} (à confirmer au client)`,
  ].join('\n');
}
