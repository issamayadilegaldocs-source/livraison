import { remplir, type Tr } from './traduire';
import type { Horaire } from './catalogue';

const JOURS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const fmt = new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Tunis', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const WD: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

/** Jour (0 = dimanche) et minute du jour à l'heure de Tunis. */
export function tunis(d: Date): { jour: number; min: number } {
  const p = Object.fromEntries(fmt.formatToParts(d).map((x) => [x.type, x.value]));
  return { jour: WD[p.weekday], min: Number(p.hour) * 60 + Number(p.minute) };
}
export const minutes = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
// "00:00" en fermeture = minuit. ponytail: no slot crossing midnight in the Sfax dump; split it in two if one appears.
const fin = (h: Horaire) => (minutes(h.ferme) <= minutes(h.ouvre) ? 24 * 60 : minutes(h.ferme));

/** Sans horaires connus, on considère le resto ouvert (le livreur confirme par téléphone). */
export function estOuvert(horaires: Horaire[], maintenant: Date): boolean {
  if (!horaires.length) return true;
  const t = tunis(maintenant);
  return horaires.some((h) => h.jour === t.jour && minutes(h.ouvre) <= t.min && t.min < fin(h));
}

export function libelleHoraire(horaires: Horaire[], maintenant: Date, tr: Tr = remplir): string {
  if (!horaires.length) return tr('Horaires non communiqués');
  const t = tunis(maintenant);
  const enCours = horaires.find((h) => h.jour === t.jour && minutes(h.ouvre) <= t.min && t.min < fin(h));
  if (enCours) return tr('Ouvert · ferme à {h}', { h: fin(enCours) === 1440 ? '00:00' : enCours.ferme });
  for (let i = 0; i < 7; i++) {
    const jour = (t.jour + i) % 7;
    const prochain = horaires
      .filter((h) => h.jour === jour && (i > 0 || minutes(h.ouvre) > t.min))
      .sort((a, b) => minutes(a.ouvre) - minutes(b.ouvre))[0];
    if (prochain) return i === 0 ? tr('Fermé · ouvre à {h}', { h: prochain.ouvre }) : tr('Fermé · ouvre {j} à {h}', { j: tr(JOURS[jour]), h: prochain.ouvre });
  }
  return tr('Fermé');
}
