// POST /api/colis : demande de livraison de colis (logique : lib/serveur.ts, traiterColis).
import livreur from '../../.build/livreur.json';
import type { Livreur } from '../../lib/livreur';
import { traiterColis, type Env } from '../../lib/serveur';

export const onRequestPost = ({ request, env }: { request: Request; env: Env }) => traiterColis(request, env, livreur as Livreur);
