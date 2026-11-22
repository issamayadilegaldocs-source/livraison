import { describe, expect, it } from 'vitest';
import { livraisonOfferte, texteLivraisonGratuite } from './livraison-gratuite';

describe('livraison gratuite', () => {
  it('sans réglage : jamais gratuite', () => expect(livraisonOfferte(null, 99000)).toBe(false));
  it('sans minimum : toujours gratuite', () => expect(livraisonOfferte({}, 1000)).toBe(true));
  it('avec minimum : dès ce panier (inclus), pas en dessous', () => {
    expect(livraisonOfferte({ min: 30 }, 29999)).toBe(false);
    expect(livraisonOfferte({ min: 30 }, 30000)).toBe(true);
  });
  it('texte de la bande', () => {
    const m = { gratuite: 'Livraison gratuite', des: 'dès' };
    expect(texteLivraisonGratuite({}, m)).toBe('Livraison gratuite');
    expect(texteLivraisonGratuite({ min: 30 }, m)).toBe('Livraison gratuite dès 30 DT');
    expect(texteLivraisonGratuite({ min: 12.5 }, m)).toBe('Livraison gratuite dès 12,5 DT');
  });
});
