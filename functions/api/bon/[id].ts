// /api/bon/<id> — sous /api/ pour être couvert par la règle de rate limiting du domaine (README).
// POST ?sig=… : le navigateur du client envoie l'image du bon qu'il vient de dessiner.
// GET : le livreur ouvre l'image depuis le lien du message WhatsApp.
import { recevoirBon, servirBon, type Env } from '../../../lib/serveur';

type Contexte = { request: Request; env: Env; params: { id: string } };

export const onRequestPost = ({ request, env, params }: Contexte) => recevoirBon(request, env, String(params.id));
export const onRequestGet = ({ env, params }: Contexte) => servirBon(env, String(params.id));
