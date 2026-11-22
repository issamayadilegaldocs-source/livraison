import { describe, expect, it } from 'vitest';
import { correspond, filtresDispo } from './filtres-plats';

describe('filtres de plats', () => {
  const r = { categories: ['Tacos', 'Crêpe Salée', 'Pâtes'] };
  it('trouve par catégorie, sans accents ni casse', () => {
    expect(correspond(r, 'Tacos')).toBe(true);
    expect(correspond(r, 'Crêpes')).toBe(true);
    expect(correspond(r, 'Pâtes')).toBe(true);
    expect(correspond(r, 'Pizza')).toBe(false);
  });
  it('ne propose que les filtres qui donnent un résultat, jamais une cuisine', () => {
    expect(filtresDispo([r])).toEqual(['Tacos', 'Pâtes', 'Crêpes']);
    expect(filtresDispo([r])).not.toContain('Italienne');
  });
});
