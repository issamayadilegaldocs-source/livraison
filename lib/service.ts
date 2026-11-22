// Le livreur prend-il des commandes ? Deux causes d'arrêt :
// - ses horaires de service (`service` dans livreur.json, réglés par le propriétaire du site) ;
// - sa pause manuelle (lien secret /api/pause, état gardé dans R2, lu par /api/etat et /api/commande).
// Pur : utilisé par le navigateur (bandeau, menu) et par la Function (qui fait foi).
import { minutes, tunis } from './horaires';
import { remplir, type Tr } from './traduire';

/** Plage de service, tous les jours, heure de Tunis. `ferme` ≤ `ouvre` = passe minuit (ex. 18:00 → 02:00). */
export type Service = { ouvre: string; ferme: string };

export function enService(service: Service | undefined, maintenant: Date): boolean {
  if (!service) return true;
  const t = tunis(maintenant).min;
  const o = minutes(service.ouvre);
  const f = minutes(service.ferme);
  return f > o ? o <= t && t < f : t >= o || t < f;
}

/** Message affiché au client quand le livreur ne prend pas de commandes, ou null s'il en prend. */
export function messageArret(service: Service | undefined, pause: boolean, maintenant: Date, retour?: string, t: Tr = remplir): string | null {
  const a = arret(service, pause, maintenant, retour, t);
  return a && t('{titre}. Les commandes sont suspendues, vous pouvez consulter les menus.', { titre: `${a.titre}${a.retour ? ` : ${a.retour}` : ''}` });
}

/** Arrêt en version courte pour le bandeau : titre + quand ça reprend. */
export function arret(service: Service | undefined, pause: boolean, maintenant: Date, retour?: string, t: Tr = remplir): { titre: string; retour: string | null } | null {
  if (pause) return { titre: t('Le livreur est en pause'), retour: retour ? t('retour {q}', { q: quand(retour, maintenant, t) }) : null };
  if (!enService(service, maintenant)) return { titre: t('Livraison fermée'), retour: t('reprise à {h}', { h: service!.ouvre }) };
  return null;
}

const JOUR = new Intl.DateTimeFormat('fr-FR', { timeZone: 'Africa/Tunis', year: 'numeric', month: '2-digit', day: '2-digit' });
const DATE_COURTE = new Intl.DateTimeFormat('fr-FR', { timeZone: 'Africa/Tunis', weekday: 'long', day: 'numeric', month: 'long' });

/** « aujourd'hui à 14:30 », « demain à 11:00 », « vendredi 20 novembre à 11:00 » (heure de Tunis). */
export function quand(dateHeure: string, maintenant: Date, t: Tr = remplir): string {
  const d = new Date(`${dateHeure}:00+01:00`);
  const heure = dateHeure.slice(11, 16);
  const jour = (x: Date) => JOUR.format(x);
  if (jour(d) === jour(maintenant)) return t('aujourd’hui à {h}', { h: heure });
  if (jour(d) === jour(new Date(maintenant.getTime() + 864e5))) return t('demain à {h}', { h: heure });
  return t('{d} à {h}', { d: DATE_COURTE.format(d), h: heure });
}
