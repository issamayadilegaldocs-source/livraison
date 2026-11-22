// Type de commerce (tuiles de l'accueil) déduit du nom et des catégories du dump, au build.
// Un commerce peut avoir plusieurs types (une supérette qui vend de la parapharmacie). « restaurants » =
// tout ce dont le nom n'est pas celui d'un magasin (épicerie, parapharmacie, fleuriste, animalerie).
// ponytail: keyword heuristic on the Sfax dump; add a per-city override file if a city's names mislead it.
import type { RestoIndex } from './catalogue';

export const TYPES = ['restaurants', 'epicerie', 'patisserie', 'cafe', 'fleurs', 'para', 'animaux'] as const;
export type TypeCommerce = (typeof TYPES)[number];

export const NOMS_TYPES: Record<TypeCommerce, string> = {
  restaurants: 'Restaurants',
  epicerie: 'Épicerie',
  patisserie: 'Pâtisserie',
  cafe: 'Cafés & jus',
  fleurs: 'Fleurs',
  para: 'Parapharmacie',
  animaux: 'Animaux',
};

type Commerce = Pick<RestoIndex, 'nom' | 'categories'>;
const cat = (r: Commerce, re: RegExp) => r.categories.some((c) => re.test(c));

const REGLES: Record<Exclude<TypeCommerce, 'restaurants'>, (r: Commerce) => boolean> = {
  animaux: (r) => /\bpets?\b|animal|animaux/i.test(r.nom) || cat(r, /^animaux|animalerie|chats?\b.*chiens?|croquettes? pour/i),
  fleurs: (r) => /fleuriste|art des fleurs|\bward\b|flower/i.test(r.nom) || cat(r, /bouquet|fleurs fraîches|compositions florales/i),
  para: (r) => /parapharmacie|\bpara\b/i.test(r.nom) || cat(r, /parapharmacie|soins visage|hygi[èe]ne/i),
  epicerie: (r) => /market|sup[ée]rette|[ée]picerie|free shop|shoppy|mazra/i.test(r.nom) || cat(r, /conserves|[ée]pices|produits laitiers|[ée]picerie/i),
  patisserie: (r) => /p[âa]tisserie|croissanterie|g[âa]teau|douceur|crumble|baklawa|donut/i.test(r.nom) || cat(r, /^p[âa]tisseries?$|^g[âa]teaux$|viennoiserie/i),
  cafe: (r) => /caf[ée]|coffee|\bjus\b|juice|salon de th[ée]|lounge/i.test(r.nom),
};

/** Un magasin (pas un restaurant) : décidé sur le NOM seulement. Une catégorie seule (« épices » chez un
 * resto) ajoute une tuile mais ne retire pas le commerce des restaurants. */
const MAGASIN = /market|sup[ée]rette|[ée]picerie|free shop|shoppy|mazra|parapharmacie|\bpara\b|fleuriste|art des fleurs|\bward\b|\bpets?\b|animal|\b3z shop\b/i;

export function typesCommerce(r: Commerce): TypeCommerce[] {
  const types = (Object.keys(REGLES) as Exclude<TypeCommerce, 'restaurants'>[]).filter((t) => REGLES[t](r));
  return MAGASIN.test(r.nom) ? types : ['restaurants', ...types];
}
