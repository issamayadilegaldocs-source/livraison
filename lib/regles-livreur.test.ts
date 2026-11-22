import { describe, expect, it } from 'vitest';
import { SupplementSchema, supplementEnCours } from './regles-livreur';

// Tunis = UTC+1 : 23:30 à Tunis = 22:30 UTC.
const tunis = (hhmm: string) => new Date(`2026-11-19T${hhmm}:00+01:00`);

describe('supplementEnCours', () => {
  it('aucun réglage ou tout éteint : pas de supplément', () => {
    expect(supplementEnCours(null, tunis('12:00'))).toBeNull();
    expect(supplementEnCours({ manuel: { actif: false, montant: 1, libelle: 'Pluie' } }, tunis('12:00'))).toBeNull();
  });
  it('bouton manuel : toujours, avec son libellé', () => {
    expect(supplementEnCours({ manuel: { actif: true, montant: 1.5, libelle: 'Pluie' } }, tunis('12:00'))).toEqual({ montant: 1.5, libelle: 'Pluie' });
  });
  it('nuit qui passe minuit (22:00 → 06:00)', () => {
    const c = SupplementSchema.parse({ nuit: { actif: true, de: '22:00', a: '06:00', montant: 2 } });
    for (const h of ['22:00', '23:59', '00:30', '05:59']) expect(supplementEnCours(c, tunis(h))?.montant).toBe(2);
    for (const h of ['06:00', '12:00', '21:59']) expect(supplementEnCours(c, tunis(h))).toBeNull();
  });
  it('nuit dans la même journée (12:00 → 14:00, rush de midi)', () => {
    const c = SupplementSchema.parse({ nuit: { actif: true, de: '12:00', a: '14:00', montant: 1 } });
    expect(supplementEnCours(c, tunis('13:00'))?.montant).toBe(1);
    expect(supplementEnCours(c, tunis('14:00'))).toBeNull();
  });
  it('manuel + nuit s’additionnent', () => {
    const c = SupplementSchema.parse({ manuel: { actif: true, montant: 1, libelle: 'Pluie' }, nuit: { actif: true, de: '22:00', a: '06:00', montant: 2 } });
    expect(supplementEnCours(c, tunis('23:00'))).toEqual({ montant: 3, libelle: 'Pluie + Nuit' });
  });
});
