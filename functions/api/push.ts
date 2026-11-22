// /api/push?cle=… : page d'activation des alertes push du livreur, abonnement et test. Logique : lib/serveur.ts.
import livreur from '../../.build/livreur.json';
import type { Livreur } from '../../lib/livreur';
import { pagePush, type Env } from '../../lib/serveur';

export const onRequest = ({ request, env }: { request: Request; env: Env }) => pagePush(request, env, livreur as Livreur);
