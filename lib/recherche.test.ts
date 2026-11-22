import { describe, expect, it } from 'vitest';
import type { RestoIndex } from './catalogue';
import { normaliser, procheDe, rechercher } from './recherche';

const r = (nom: string, plats: string[] = [], cuisines: string[] = []): RestoIndex => ({
  id: nom.length, slug: nom, nom, adresse: '', telephone: '', logo: null, couverture: null, note: 0, nbAvis: 0, delai: '',
  cuisines, categories: [], horaires: [], position: { lat: 0, lng: 0 }, popularite: 0, plats,
});
const restos = [r('Le Moulin', ['Crêpe Nutella']), r('Crêperie Sfax'), r('Pizza Roma', [], ['Italienne'])];

describe('normaliser', () => {
  it('retire accents et casse', () => expect(normaliser('CRÊPE Œuf')).toBe('crepe oeuf'));
});

describe('rechercher', () => {
  it('trouve par plat, insensible aux accents', () => {
    expect(rechercher(restos, 'crepe').map((x) => x.nom)).toEqual(['Crêperie Sfax', 'Le Moulin']);
    expect(rechercher(restos, 'CRÊPE').map((x) => x.nom)).toEqual(['Crêperie Sfax', 'Le Moulin']);
  });
  it('trouve par cuisine', () => expect(rechercher(restos, 'italien').map((x) => x.nom)).toEqual(['Pizza Roma']));
  it('requête vide → tout', () => expect(rechercher(restos, '  ')).toHaveLength(3));
});

describe('recherche tolérante aux fautes', () => {
  const restos = [{ nom: 'Pizza Mario', cuisines: ['Italienne'], categories: [], plats: ['Margherita', 'Tacos poulet'] }];
  it('trouve malgré une faute de frappe', () => {
    expect(rechercher(restos, 'pizzza')).toHaveLength(1);
    expect(rechercher(restos, 'margarita')).toHaveLength(0); // 2 lettres d'écart : trop loin
    expect(rechercher(restos, 'tacoz')).toHaveLength(1);
  });
  it('ignore les mots trop courts et ne remplace pas une vraie réponse', () => {
    expect(rechercher(restos, 'piz')).toHaveLength(1); // sous-chaîne exacte
    expect(rechercher(restos, 'xyz')).toHaveLength(0);
  });
  it('procheDe', () => {
    expect(procheDe('tacos', 'tacoz')).toBe(true);
    expect(procheDe('tacos', 'taco')).toBe(true);
    expect(procheDe('tacos', 'tac')).toBe(false);
  });
});
