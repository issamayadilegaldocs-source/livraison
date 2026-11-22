import { describe, expect, it } from 'vitest';
import { estOuvert, libelleHoraire } from './horaires';

// Tunis = UTC+1 toute l'année. 2026-11-16 est un lundi.
const tunis = (iso: string) => new Date(`${iso}+01:00`);
const lundiMardi = [
  { jour: 1, ouvre: '11:00', ferme: '21:00' },
  { jour: 2, ouvre: '11:00', ferme: '21:00' },
];

describe('estOuvert', () => {
  it('ouvert pendant le créneau', () => expect(estOuvert(lundiMardi, tunis('2026-11-16T12:00:00'))).toBe(true));
  it('fermé après la fermeture', () => expect(estOuvert(lundiMardi, tunis('2026-11-16T22:00:00'))).toBe(false));
  it('fermé un jour sans créneau', () => expect(estOuvert(lundiMardi, tunis('2026-11-18T12:00:00'))).toBe(false));
  it('sans horaires → considéré ouvert', () => expect(estOuvert([], tunis('2026-11-16T03:00:00'))).toBe(true));
  it('gère un créneau qui finit à minuit (00:00)', () =>
    expect(estOuvert([{ jour: 1, ouvre: '18:00', ferme: '00:00' }], tunis('2026-11-16T23:30:00'))).toBe(true));
  it('utilise l’heure de Tunis, pas celle du serveur', () =>
    expect(estOuvert(lundiMardi, new Date('2026-11-16T10:30:00Z'))).toBe(true)); // 11:30 à Tunis
});

describe('libelleHoraire', () => {
  it('ouvert', () => expect(libelleHoraire(lundiMardi, tunis('2026-11-16T12:00:00'))).toBe('Ouvert · ferme à 21:00'));
  it('fermé, ouvre plus tard le même jour', () =>
    expect(libelleHoraire(lundiMardi, tunis('2026-11-16T09:00:00'))).toBe('Fermé · ouvre à 11:00'));
  it('fermé, ouvre un autre jour', () =>
    expect(libelleHoraire(lundiMardi, tunis('2026-11-16T22:00:00'))).toBe('Fermé · ouvre mardi à 11:00'));
  it('sans horaires', () => expect(libelleHoraire([], tunis('2026-11-16T12:00:00'))).toBe('Horaires non communiqués'));
});
