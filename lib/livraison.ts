import { remplir, type Tr } from './traduire';
// Frais de livraison selon la distance resto → client. Pur : partagé client (aperçu) et serveur (calcul qui fait foi).
export type Point = { lat: number; lng: number };
export type ConfLivraison = { base: number; parKm: number; min: number; max: number; rayonMaxKm: number; facteurRoute: number };

const R = 6371.0088; // rayon moyen de la Terre, km

/** Distance à vol d'oiseau (haversine), en km. */
export function distanceKm(a: Point, b: Point): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// ponytail: straight line × facteurRoute approximates the road trip (±10-20 % in town).
// Swap in a routing API (OpenRouteService) here if riders complain about the estimate.
export function calculerLivraison(conf: ConfLivraison, resto: Point, client: Point, t: Tr = remplir): { km: number; frais: number } | { erreur: string } {
  const km = Math.round(distanceKm(resto, client) * conf.facteurRoute * 10) / 10;
  if (km > conf.rayonMaxKm) return { erreur: t('Adresse trop loin : {km} km (livraison jusqu’à {max} km de ce restaurant).', { km, max: conf.rayonMaxKm }) };
  const brut = conf.base + conf.parKm * km;
  const arrondi = Math.ceil(Math.round(brut * 1000) / 500) / 2; // au 0,5 DT supérieur, sans bruit de flottant
  return { km, frais: Math.min(conf.max, Math.max(conf.min, arrondi)) };
}

/** Précision au-delà de laquelle la position (souvent IP / Wi-Fi sur PC) doit être corrigée sur la carte. */
export const PRECISION_MAX_M = 150;
export const positionPrecise = (precisionM: number) => precisionM <= PRECISION_MAX_M;

/** Distance (km) au-delà de laquelle une position approximative n'aide pas à centrer la carte (ex. IP à Tunis). */
const RAYON_VILLE_KM = 30;

/** Après la recherche GPS : accepter la position, ou ouvrir la carte centrée au mieux pour que le client ajuste. */
export function departCarte(meilleure: (Point & { precision: number }) | null, resto: Point): { accepter: boolean; centre: Point } {
  if (!meilleure) return { accepter: false, centre: resto };
  const centre = { lat: meilleure.lat, lng: meilleure.lng };
  if (positionPrecise(meilleure.precision)) return { accepter: true, centre };
  return { accepter: false, centre: distanceKm(centre, resto) <= RAYON_VILLE_KM ? centre : resto };
}
