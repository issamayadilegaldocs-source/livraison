// POST /api/coupon {code, resto} : le client tape un code dans son panier ; on lui dit si le code existe et ce qu'il
// donne (jamais qui paie ni les autres codes). Logique : lib/serveur.ts.
import livreur from '../../.build/livreur.json';
import type { Livreur } from '../../lib/livreur';
import { verifierCoupon, type Env } from '../../lib/serveur';

export const onRequestPost = ({ request, env }: { request: Request; env: Env }) => verifierCoupon(request, env, livreur as Livreur);
