import { describe, expect, it } from 'vitest';
import type { Plat } from './catalogue';
import { prixUnitaire, resumeChoix, validerChoix } from './options';

const plat: Plat = {
  id: 534, nom: 'Sandwich Cordon Bleu', description: '', image: null, prix: 8.9, prixOrigine: null, categorieId: 3, populaire: false,
  groupes: [
    { nom: 'Taille', type: 'single', obligatoire: true, min: 1, max: 1, options: [{ label: 'L Baguette', prix: 0 }, { label: 'XL Baguette', prix: 4.9 }] },
    { nom: 'Sauce', type: 'multi', obligatoire: false, min: 0, max: 2, options: [{ label: 'Harissa', prix: 0 }, { label: 'Mayo', prix: 0 }, { label: 'Ketchup', prix: 0 }] },
    { nom: 'Supplément', type: 'multi', obligatoire: false, min: 0, max: 5, options: [{ label: 'Cheddar', prix: 2 }, { label: 'Œuf', prix: 1 }, { label: 'Thon', prix: 2.5 }] },
  ],
};

describe('validerChoix', () => {
  it('exige les groupes obligatoires', () => expect(validerChoix(plat, {})).toBe('Choisissez : Taille'));
  it('limite le max des multi', () => expect(validerChoix(plat, { 0: [0], 1: [0, 1, 2] })).toBe('Maximum 2 pour : Sauce'));
  it('refuse plusieurs choix sur un single', () => expect(validerChoix(plat, { 0: [0, 1] })).toBe('Un seul choix pour : Taille'));
  it('refuse un index hors limites ou un groupe inconnu', () => {
    expect(validerChoix(plat, { 0: [7] })).toBeTruthy();
    expect(validerChoix(plat, { 0: [0], 9: [0] })).toBeTruthy();
  });
  it('refuse les doublons', () => expect(validerChoix(plat, { 0: [0], 1: [0, 0] })).toBeTruthy());
  it('accepte un choix valide', () => expect(validerChoix(plat, { 0: [1], 1: [0] })).toBeNull());
});

describe('prixUnitaire', () => {
  it('ajoute les options payantes', () => expect(prixUnitaire(plat, { 0: [1] })).toBe(13.8));
  it('additionne sans erreur de flottant', () => expect(prixUnitaire(plat, { 0: [0], 2: [0, 1, 2] })).toBe(14.4));
});

describe('resumeChoix', () => {
  it('liste les options choisies', () => expect(resumeChoix(plat, { 0: [1], 1: [0, 1] })).toBe('XL Baguette, Harissa, Mayo'));
});
