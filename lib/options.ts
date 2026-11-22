// Options d'un plat : partagé client (fenêtre plat, panier) et serveur (recalcul).
import type { Plat } from './catalogue';
import { remplir, type Tr } from './traduire';

/** index du groupe → index des options choisies */
export type Choix = Record<number, number[]>;

export function validerChoix(plat: Plat, choix: Choix, t: Tr = remplir): string | null {
  for (const k of Object.keys(choix)) {
    const g = plat.groupes[Number(k)];
    if (!g) return t('Option inconnue.');
    const sel = choix[Number(k)];
    if (new Set(sel).size !== sel.length || sel.some((i) => !Number.isInteger(i) || !g.options[i])) return t('Choix invalide pour : {nom}', { nom: g.nom });
  }
  for (const [i, g] of plat.groupes.entries()) {
    const n = (choix[i] ?? []).length;
    if (g.type === 'single' && n > 1) return t('Un seul choix pour : {nom}', { nom: g.nom });
    if (n < g.min) return t('Choisissez : {nom}', { nom: g.nom });
    if (n > g.max) return t('Maximum {max} pour : {nom}', { max: g.max, nom: g.nom });
  }
  return null;
}

const mil = (n: number) => Math.round(n * 1000);

export function prixUnitaire(plat: Plat, choix: Choix): number {
  let total = mil(plat.prix);
  for (const [k, sel] of Object.entries(choix)) for (const i of sel) total += mil(plat.groupes[Number(k)]?.options[i]?.prix ?? 0);
  return total / 1000;
}

export function resumeChoix(plat: Plat, choix: Choix): string {
  return plat.groupes
    .flatMap((g, i) => (choix[i] ?? []).map((o) => g.options[o]?.label))
    .filter(Boolean)
    .join(', ');
}
