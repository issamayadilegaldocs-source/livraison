import { normaliser } from './recherche';

/** Filtres de la page Restaurants : ce qu'on mange (tacos, sandwich…), pas la cuisine du pays. `mots` = morceaux de catégorie (sans accents). */
export const FILTRES_PLATS = [
  { nom: 'Sandwich', mots: ['sandwich', 'baguette farcie', 'panuzzo'] },
  { nom: 'Pizza', mots: ['pizza', 'calzone'] },
  { nom: 'Makloub', mots: ['makloub'] },
  { nom: 'Mlewi', mots: ['mlewi'] },
  { nom: 'Tacos', mots: ['tacos'] },
  { nom: 'Burger', mots: ['burger'] },
  { nom: 'Pâtes', mots: ['pates', 'lasagne'] },
  { nom: 'Salades', mots: ['salade'] },
  { nom: 'Brik', mots: ['brik'] },
  { nom: 'Ojja', mots: ['ojja'] },
  { nom: 'Crêpes', mots: ['crepe'] },
  { nom: 'Poulet', mots: ['poulet'] },
  { nom: 'Grillades', mots: ['grillade'] },
  { nom: 'Fruits de mer', mots: ['fruits de mer'] },
  { nom: 'Desserts', mots: ['gaufre', 'pancake', 'cheesecake', 'tiramisu', 'dessert', 'gateau'] },
  { nom: 'Petit-déjeuner', mots: ['petit-dej'] },
  { nom: 'Jus', mots: ['jus', 'milkshake'] },
];

export const correspond = (r: { categories: string[] }, nom: string) => {
  const f = FILTRES_PLATS.find((x) => x.nom === nom);
  return !!f && r.categories.some((c) => f.mots.some((m) => normaliser(c).includes(m)));
};

/** Seulement les filtres qui donnent au moins un resto. */
export const filtresDispo = (restos: { categories: string[] }[]) => FILTRES_PLATS.filter((f) => restos.some((r) => correspond(r, f.nom))).map((f) => f.nom);
