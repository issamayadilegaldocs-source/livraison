// GET /api/etat[?resto=<slug>] : réglages du livreur pour l'affichage (pause, horaires, frais, prix corrigés).
import livreur from '../../.build/livreur.json';
import type { Livreur } from '../../lib/livreur';
import { etatLivreur, type Env } from '../../lib/serveur';

export const onRequestGet = ({ request, env }: { request: Request; env: Env }) => etatLivreur(request, env, livreur as Livreur);
