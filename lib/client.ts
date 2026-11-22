import { z } from 'zod';

/**
 * Coordonnées du client gardées sur son téléphone (localStorage) après une commande,
 * pour préremplir la suivante, quel que soit le restaurant. Rien n'est envoyé ailleurs.
 */
export const CLE_CLIENT = 'client';

const ClientSchema = z.object({
  nom: z.string().max(80),
  tel: z.string().max(30),
  adresse: z.string().max(300),
  email: z.string().max(120).optional(),
  position: z.object({ lat: z.number(), lng: z.number(), label: z.string().max(300) }).nullable(),
});

export type ClientMemorise = z.infer<typeof ClientSchema>;

/** Texte stocké → coordonnées, ou `null` si absent / abîmé / d'un ancien format. */
export function lireClient(brut: string | null): ClientMemorise | null {
  if (!brut) return null;
  try {
    const r = ClientSchema.safeParse(JSON.parse(brut));
    return r.success ? r.data : null;
  } catch {
    return null;
  }
}
