import { describe, expect, it } from 'vitest';
import { typesCommerce } from './types-commerce';

const c = (nom: string, categories: string[] = []) => typesCommerce({ nom, categories });

describe('typesCommerce', () => {
  it('un resto reste un resto, même avec une catégorie « épices »', () => {
    expect(c('Chicken House', ['Sels Épices & Assaisonnement'])).toEqual(['restaurants', 'epicerie']);
    expect(c('Pizza Roma', ['Pizza', 'Boissons'])).toEqual(['restaurants']);
  });
  it('magasins décidés sur le nom : pas dans les restaurants', () => {
    expect(c('El Kaied Super Market')).toEqual(['epicerie']);
    expect(c('Parapharmacie Faten')).toEqual(['para']);
    expect(c('Dream Pets Taniour', ['Parapharmacie & Accessoires'])).toEqual(['animaux', 'para']);
    expect(c('L’art Des Fleurs')).toEqual(['fleurs']);
  });
  it('« petit » n’est pas une animalerie (pets en mot entier)', () => expect(c('Petit Sandwich')).toEqual(['restaurants']));
  it('pâtisseries et cafés restent aussi des restaurants', () => {
    expect(c('Pâtisserie Fostka')).toEqual(['restaurants', 'patisserie']);
    expect(c('Milos Coffee House')).toEqual(['restaurants', 'cafe']);
  });
});
