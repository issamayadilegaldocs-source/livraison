// /api/config?cle=… : page secrète du livreur (pause, horaires, frais, prix des plats). Logique : lib/serveur.ts.
import livreur from '../../.build/livreur.json';
import type { Livreur } from '../../lib/livreur';
import { pageConfig, type DonneesResto, type Env } from '../../lib/serveur';

type Contexte = { request: Request; env: Env & { ASSETS: { fetch: (req: string) => Promise<Response> } } };

export const onRequest = ({ request, env }: Contexte) => {
  // Fichiers statiques générés au build (resto + menu d'un resto ; liste des restos).
  const asset = async <T>(chemin: string): Promise<T | null> => {
    const res = await env.ASSETS.fetch(new URL(chemin, request.url).toString());
    return res.ok ? ((await res.json()) as T) : null;
  };
  return pageConfig(
    request,
    env,
    livreur as Livreur,
    (slug) => asset<DonneesResto>(`/commande-data/${slug}`),
    async () => (await asset<{ slug: string; nom: string }[]>('/restos.json')) ?? [],
  );
};
