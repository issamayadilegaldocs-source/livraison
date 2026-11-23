// Vercel Function unique : route tout /api/* (via rewrite dans vercel.json) vers lib/serveur.ts et lib/plateforme.ts.
// Le site reste un export statique (out/) ; seul /api/* tourne ici. Config du livreur : .build/livreur.json (écrit par `npm run build`).
import livreur from '../.build/livreur.json';
import type { Livreur } from '../lib/livreur';
import {
  etatLivreur, pageCommandes, pageConfig, pagePush, recevoirBon, servirBon,
  traiterColis, traiterCommande, verifierCoupon, type DonneesResto, type Env,
} from '../lib/serveur';
import {
  endpointRestosLive, gererAdmin, gererAuth, gererCompte, majPositionLivreur, suiviPublic,
} from '../lib/plateforme';
import {
  gererAvis, gererChat, gererParrainage, gererSupport,
} from '../lib/app-features';

const L = livreur as Livreur;
const env = process.env as unknown as Env;

/** GET d'un fichier JSON statique du site déployé (même origine que la requête). */
export const assetJson = async <T>(request: Request, chemin: string): Promise<T | null> => {
  const res = await fetch(new URL(chemin, request.url));
  return res.ok ? ((await res.json()) as T) : null;
};

const NON = (allow: string) => new Response('Method Not Allowed', { status: 405, headers: { Allow: allow } });

export async function route(request: Request): Promise<Response> {
  const u = new URL(request.url);
  const rewritten = u.searchParams.get('__path');
  const segments = rewritten
    ? rewritten.split('/').filter(Boolean)
    : u.pathname.replace(/^\/api\/?/, '').split('/').filter(Boolean);
  const [nom = '', id = ''] = segments;
  const m = request.method;
  switch (nom) {
    case 'auth': return gererAuth(request, env, id);
    case 'compte': return gererCompte(request, env, id);
    case 'avis': return gererAvis(request, env);
    case 'chat': return gererChat(request, env);
    case 'parrainage': return gererParrainage(request, env, L);
    case 'support': return gererSupport(request, env, L);
    case 'livreur': return id === 'position' && m === 'POST' ? majPositionLivreur(request, env, L) : NON('POST');
    case 'suivi': return m === 'GET' ? suiviPublic(request, env) : NON('GET');
    case 'restos-live': return m === 'GET' ? endpointRestosLive(request, env) : NON('GET');
    case 'admin': return gererAdmin(request, env, L, id);
    case 'etat': return m === 'GET' ? etatLivreur(request, env, L) : NON('GET');
    case 'commande':
      return m === 'POST'
        ? traiterCommande(request, env, L, (slug) => assetJson<DonneesResto>(request, `/commande-data/${slug}`))
        : NON('POST');
    case 'colis': return m === 'POST' ? traiterColis(request, env, L) : NON('POST');
    case 'coupon': return m === 'POST' ? verifierCoupon(request, env, L) : NON('POST');
    case 'commandes': return pageCommandes(request, env, L);
    case 'push': return pagePush(request, env, L);
    case 'config':
      return pageConfig(
        request, env, L,
        (slug) => assetJson<DonneesResto>(request, `/commande-data/${slug}`),
        async () => (await assetJson<{ slug: string; nom: string }[]>(request, '/restos.json')) ?? [],
      );
    case 'bon':
      return m === 'POST' ? recevoirBon(request, env, id) : m === 'GET' ? servirBon(env, id) : NON('GET, POST');
    default: return new Response('Not Found', { status: 404 });
  }
}

export { route as GET, route as POST, route as PUT, route as DELETE, route as PATCH, route as OPTIONS, route as HEAD };
