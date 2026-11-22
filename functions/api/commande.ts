// POST /api/commande (Cloudflare Pages Function). La logique est dans lib/serveur.ts (testée avec vitest).
// .build/livreur.json est écrit par `npm run build` pour le client (CLIENT) : la config du livreur,
// dont son email, est intégrée au code de la Function et n'est pas publiée comme fichier.
import livreur from '../../.build/livreur.json';
import type { Livreur } from '../../lib/livreur';
import { traiterCommande, type DonneesResto, type Env } from '../../lib/serveur';

type Contexte = { request: Request; env: Env & { ASSETS: { fetch: (req: Request | string) => Promise<Response> } } };

export async function onRequestPost({ request, env }: Contexte): Promise<Response> {
  return traiterCommande(request, env, livreur as Livreur, async (slug) => {
    // Fichier statique généré au build (app/commande-data/[slug]/route.ts) : resto + menu de ce seul resto.
    const res = await env.ASSETS.fetch(new URL(`/commande-data/${slug}`, request.url).toString());
    if (!res.ok) return null;
    return (await res.json()) as DonneesResto;
  });
}
