// /api/commandes?cle=… : commandes en cours et historique du livreur (livrée / annulée). Logique : lib/serveur.ts.
import livreur from '../../.build/livreur.json';
import type { Livreur } from '../../lib/livreur';
import { pageCommandes, type Env } from '../../lib/serveur';

export const onRequest = ({ request, env }: { request: Request; env: Env }) => pageCommandes(request, env, livreur as Livreur);
