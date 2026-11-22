import { describe, expect, it } from 'vitest';
import { erreurAdresse, erreurNom, erreurTelephone } from './validation';

describe('erreurTelephone', () => {
  it.each(['22 123 456', '+216 22123456', '0021622123456', '93028832', '71 000 001'])('%s est valide', (t) => expect(erreurTelephone(t)).toBeNull());
  it('vide → obligatoire', () => expect(erreurTelephone('  ')).toContain('obligatoire'));
  it('lettres → seulement des chiffres', () => expect(erreurTelephone('22a23456')).toContain('chiffres'));
  it('trop court → indique combien il manque', () => expect(erreurTelephone('22 123')).toBe('Il manque 3 chiffres (8 chiffres).'));
  it('trop long', () => expect(erreurTelephone('221234567')).toContain('trop long'));
  it('commence par 0 ou 1 → invalide', () => expect(erreurTelephone('12345678')).toContain('invalide'));
});

describe('erreurNom / erreurAdresse', () => {
  it('nom vide ou trop court', () => {
    expect(erreurNom('')).toContain('obligatoire');
    expect(erreurNom('A')).toContain('trop court');
    expect(erreurNom('Sami')).toBeNull();
  });
  it('adresse vide ou trop courte', () => {
    expect(erreurAdresse('')).toContain('Précisez');
    expect(erreurAdresse('abc')).toContain('trop courte');
    expect(erreurAdresse('Rue de Rome 12')).toBeNull();
  });
});
