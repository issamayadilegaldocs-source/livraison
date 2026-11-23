'use client';

export type RestoFavori = {
  slug: string;
  nom: string;
  couverture?: string | null;
  logo?: string | null;
  cuisines?: string[];
  delai?: string;
  href?: string;
};

export type AdresseClient = {
  id: string;
  label: 'Maison' | 'Travail' | 'Autre';
  adresse: string;
  detail?: string;
  defaut?: boolean;
};

const CLE_FAVORIS = 'app_favoris_v1';
const CLE_ADRESSES = 'app_adresses_v1';
export const EVT_FAVORIS = 'app:favoris';
export const EVT_ADRESSES = 'app:adresses';

export function lireFavoris(): RestoFavori[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = JSON.parse(localStorage.getItem(CLE_FAVORIS) ?? '[]');
    return Array.isArray(raw) ? raw.filter((x) => x && typeof x.slug === 'string' && typeof x.nom === 'string') : [];
  } catch {
    return [];
  }
}

export function estFavori(slug: string): boolean {
  return lireFavoris().some((f) => f.slug === slug);
}

export function basculerFavori(resto: RestoFavori): RestoFavori[] {
  const cur = lireFavoris();
  const exists = cur.some((f) => f.slug === resto.slug);
  const next = exists ? cur.filter((f) => f.slug !== resto.slug) : [resto, ...cur].slice(0, 60);
  try {
    localStorage.setItem(CLE_FAVORIS, JSON.stringify(next));
    window.dispatchEvent(new Event(EVT_FAVORIS));
  } catch {
    /* ignore */
  }
  return next;
}

export function lireAdresses(): AdresseClient[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = JSON.parse(localStorage.getItem(CLE_ADRESSES) ?? '[]');
    return Array.isArray(raw) ? raw.filter((x) => x && typeof x.id === 'string' && typeof x.adresse === 'string') : [];
  } catch {
    return [];
  }
}

export function sauvegarderAdresses(liste: AdresseClient[]): AdresseClient[] {
  const clean = liste.slice(0, 10);
  try {
    localStorage.setItem(CLE_ADRESSES, JSON.stringify(clean));
    window.dispatchEvent(new Event(EVT_ADRESSES));
  } catch {
    /* ignore */
  }
  return clean;
}

export function ajouterAdresse(
  label: AdresseClient['label'],
  adresse: string,
  detail = '',
): AdresseClient[] {
  const txt = adresse.trim();
  if (!txt) return lireAdresses();
  const cur = lireAdresses();
  const nouvelle: AdresseClient = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    label,
    adresse: txt,
    detail: detail.trim() || undefined,
    defaut: cur.length === 0,
  };
  return sauvegarderAdresses([nouvelle, ...cur]);
}

export function definirAdresseDefaut(id: string): AdresseClient[] {
  const next = lireAdresses().map((a) => ({ ...a, defaut: a.id === id }));
  return sauvegarderAdresses(next);
}

export function supprimerAdresse(id: string): AdresseClient[] {
  const next = lireAdresses().filter((a) => a.id !== id);
  if (next.length > 0 && !next.some((a) => a.defaut)) next[0] = { ...next[0], defaut: true };
  return sauvegarderAdresses(next);
}
