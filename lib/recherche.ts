import type { RestoIndex } from './catalogue';

export const normaliser = (s: string) =>
  s.replace(/œ/gi, 'oe').replace(/æ/gi, 'ae').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

type Cherchable = Pick<RestoIndex, 'nom' | 'cuisines' | 'categories' | 'plats'>;

// Normalised text cached per resto: ~20k dish names would otherwise be re-normalised on every keystroke.
const cache = new WeakMap<Cherchable, { nom: string; reste: string }>();
const textes = (r: Cherchable) => {
  let t = cache.get(r);
  if (!t) cache.set(r, (t = { nom: normaliser(r.nom), reste: normaliser([...r.cuisines, ...r.categories, ...r.plats].join('\n')) }));
  return t;
};

/** Distance d'édition ≤ 1 (une lettre en trop, en moins ou différente). */
export function procheDe(a: string, b: string): boolean {
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  if (a.length === b.length) return a.slice(i + 1) === b.slice(i + 1);
  return a.length > b.length ? a.slice(i + 1) === b.slice(i) : a.slice(i) === b.slice(i + 1);
}

/** Faute de frappe : un mot de la requête (4 lettres min.) est à 1 lettre d'un mot du resto, d'une cuisine ou d'un plat. */
const approx = (n: string, texte: string) => {
  const mots = new Set(texte.split(/[^a-z0-9؀-ۿ]+/));
  return n.split(/\s+/).some((m) => m.length >= 4 && [...mots].some((w) => procheDe(m, w)));
};

/** Restos dont le nom, une cuisine, une catégorie ou un plat contient la requête. Noms en premier. */
export function rechercher<T extends Cherchable>(restos: T[], q: string): T[] {
  const n = normaliser(q);
  if (!n) return restos;
  const parNom: T[] = [];
  const autres: T[] = [];
  for (const r of restos) {
    const t = textes(r);
    if (t.nom.includes(n)) parNom.push(r);
    else if (t.reste.includes(n)) autres.push(r);
  }
  // ponytail: balayage linéaire de tous les mots, seulement quand la recherche exacte ne trouve rien (~20k plats : quelques ms).
  if (!parNom.length && !autres.length) return restos.filter((r) => approx(n, `${textes(r).nom} ${textes(r).reste}`));
  return [...parNom, ...autres];
}
