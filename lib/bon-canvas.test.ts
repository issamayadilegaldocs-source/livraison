import { describe, expect, it } from 'vitest';
import { couperLignes } from './bon-canvas';

// 10 px par caractère : assez pour tester la coupure sans canvas.
const mesurer = (t: string) => t.length * 10;

describe('couperLignes', () => {
  it('garde un texte court sur une ligne', () => expect(couperLignes(mesurer, 'Pizza thon', 200)).toEqual(['Pizza thon']));
  it('coupe entre les mots', () => expect(couperLignes(mesurer, 'Sauce harissa fromage oeuf', 140)).toEqual(['Sauce harissa', 'fromage oeuf']));
  it('limite le nombre de lignes avec « … »', () => {
    expect(couperLignes(mesurer, 'un deux trois quatre cinq six', 70, 2)).toEqual(['un deux', 'trois…']);
  });
  it('garde un mot trop long entier plutôt que de boucler', () => expect(couperLignes(mesurer, 'Supercalifragilistique', 50)).toEqual(['Supercalifragilistique']));
});
