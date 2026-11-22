// Catalogue de la ville, généré par `npm run import` dans villes/<ville>/. Lu au build uniquement (fs) ;
// les composants client et la Function n'importent que les types (`import type`).
import fs from 'node:fs';
import path from 'node:path';
import { dossierVille, getLivreur } from './livreur';

export type Horaire = { jour: number; ouvre: string; ferme: string };

export type RestoIndex = {
  id: number;
  slug: string;
  nom: string;
  adresse: string;
  telephone: string;
  logo: string | null;
  couverture: string | null;
  note: number;
  nbAvis: number;
  delai: string;
  cuisines: string[];
  categories: string[];
  horaires: Horaire[];
  position: { lat: number; lng: number };
  popularite: number;
  plats: string[];
};

/** `prix` = prix payé par le client ; `prixResto` = prix du resto, avant la majoration du livreur (absent = identique). */
export type Option = { label: string; prix: number; prixResto?: number };
export type Groupe = { nom: string; type: 'single' | 'multi'; obligatoire: boolean; min: number; max: number; options: Option[] };
export type Plat = {
  id: number;
  nom: string;
  description: string;
  image: string | null;
  prix: number;
  prixOrigine: number | null;
  categorieId: number;
  groupes: Groupe[];
  populaire: boolean;
  prixResto?: number;
};
export type Menu = { restoId: number; categories: { id: number; nom: string }[]; plats: Plat[] };
export type Cuisine = { nom: string; image: string | null };

// Données de la ville du livreur ; DATA_DIR les remplace (tests : fixtures).
export const dataDir = () => path.resolve(process.env.DATA_DIR || path.join('villes', dossierVille(getLivreur().ville)));
const lire = <T>(f: string): T => JSON.parse(fs.readFileSync(path.join(dataDir(), f), 'utf8')) as T;

let restos: RestoIndex[] | null = null;
let parSlug: Map<string, RestoIndex> | null = null;

export function getRestos(): RestoIndex[] {
  restos ??= lire<RestoIndex[]>('restos.json');
  return restos;
}

export function getResto(slug: string): RestoIndex | null {
  parSlug ??= new Map(getRestos().map((r) => [r.slug, r]));
  return parSlug.get(slug) ?? null;
}

export function getMenu(restoId: number): Menu | null {
  if (!Number.isInteger(restoId)) return null;
  const f = path.join(dataDir(), 'menus', `${restoId}.json`);
  return fs.existsSync(f) ? (JSON.parse(fs.readFileSync(f, 'utf8')) as Menu) : null;
}

export function getCuisines(): Cuisine[] {
  return lire<Cuisine[]>('cuisines.json');
}

export { imageUrl } from './media';
