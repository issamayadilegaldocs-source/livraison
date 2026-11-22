// Recherche d'adresse via Nominatim (OpenStreetMap), gratuit.
// Politique d'usage : 1 requête/s max, pas d'autocomplétion à chaque frappe → on cherche sur validation.
// ponytail: public Nominatim is fine for a demo's traffic; switch to a paid geocoder if volume grows.
import type { Point } from './livraison';

const BASE = 'https://nominatim.openstreetmap.org';
const MARGE = 0.25; // degrés autour de la ville pour privilégier les résultats locaux

export type Resultat = { label: string; detail: string; point: Point };

type Nominatim = {
  lat: string;
  lon: string;
  display_name: string;
  address?: Record<string, string | undefined>;
};

export function urlRecherche(q: string, centre: Point): string {
  const p = new URLSearchParams({
    q,
    format: 'jsonv2',
    addressdetails: '1',
    countrycodes: 'tn',
    'accept-language': 'fr',
    limit: '6',
    viewbox: [centre.lng - MARGE, centre.lat + MARGE, centre.lng + MARGE, centre.lat - MARGE].map((n) => n.toFixed(2)).join(','),
  });
  return `${BASE}/search?${p}`;
}

export function urlInverse(pt: Point): string {
  const p = new URLSearchParams({ lat: pt.lat.toFixed(6), lon: pt.lng.toFixed(6), format: 'jsonv2', zoom: '18', addressdetails: '1', 'accept-language': 'fr' });
  return `${BASE}/reverse?${p}`;
}

export function lireResultat(r: Nominatim): Resultat {
  const a = r.address ?? {};
  const rue = [a.house_number, a.road ?? a.pedestrian ?? a.footway].filter(Boolean).join(' ');
  const quartier = a.suburb ?? a.neighbourhood ?? a.quarter ?? a.village;
  const ville = a.city ?? a.town ?? a.municipality ?? a.state;
  const point = { lat: Number(r.lat), lng: Number(r.lon) };
  if (rue) return { label: rue, detail: [quartier, ville].filter(Boolean).join(', '), point };
  const parties = r.display_name.split(',').map((s) => s.trim()).filter((s) => s && !/^\d{4}$/.test(s) && s !== 'Tunisie');
  return { label: parties[0] ?? r.display_name, detail: parties.slice(1, 3).join(', '), point };
}

export async function rechercherAdresse(q: string, centre: Point): Promise<Resultat[]> {
  const res = await fetch(urlRecherche(q, centre));
  if (!res.ok) throw new Error(`Nominatim ${res.status}`);
  return ((await res.json()) as Nominatim[]).map(lireResultat);
}

export async function adresseDuPoint(pt: Point): Promise<Resultat | null> {
  const res = await fetch(urlInverse(pt));
  if (!res.ok) return null;
  const j = (await res.json()) as Nominatim & { error?: string };
  return j.error ? null : lireResultat(j);
}
