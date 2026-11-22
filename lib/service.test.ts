import { describe, expect, it } from 'vitest';
import { enService, messageArret, quand } from './service';

// Heure de Tunis = UTC+1 toute l'année.
const a = (hhmm: string) => new Date(`2026-11-16T${hhmm}:00+01:00`);

describe('enService', () => {
  it('toujours en service sans horaires', () => expect(enService(undefined, a('04:00'))).toBe(true));
  it('plage dans la journée : ouvre incluse, ferme exclue', () => {
    const s = { ouvre: '11:00', ferme: '23:30' };
    expect(enService(s, a('10:59'))).toBe(false);
    expect(enService(s, a('11:00'))).toBe(true);
    expect(enService(s, a('23:29'))).toBe(true);
    expect(enService(s, a('23:30'))).toBe(false);
  });
  it('plage qui passe minuit', () => {
    const s = { ouvre: '18:00', ferme: '02:00' };
    expect(enService(s, a('17:59'))).toBe(false);
    expect(enService(s, a('23:00'))).toBe(true);
    expect(enService(s, a('01:59'))).toBe(true);
    expect(enService(s, a('02:00'))).toBe(false);
  });
});

describe('messageArret', () => {
  const s = { ouvre: '11:00', ferme: '23:30' };
  it('null quand le livreur prend des commandes', () => expect(messageArret(s, false, a('12:00'))).toBeNull());
  it('hors service : annonce l’heure de reprise', () => expect(messageArret(s, false, a('09:00'))).toContain('reprise à 11:00'));
  it('la pause l’emporte sur les horaires', () => expect(messageArret(s, true, a('12:00'))).toContain('en pause'));
});

describe('quand / retour de pause', () => {
  const now = new Date('2026-11-18T10:00:00+01:00'); // mercredi
  it('aujourd’hui, demain, puis jour en toutes lettres', () => {
    expect(quand('2026-11-18T14:30', now)).toBe('aujourd’hui à 14:30');
    expect(quand('2026-11-19T11:00', now)).toBe('demain à 11:00');
    expect(quand('2026-11-20T11:00', now)).toBe('vendredi 20 novembre à 11:00');
  });
  it('le message annonce le retour', () => expect(messageArret(undefined, true, now, '2026-11-18T14:30')).toContain('retour aujourd’hui à 14:30'));
});
