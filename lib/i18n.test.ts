import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { AR } from './ar';
import { remplir, traducteur } from './traduire';

// Clés utilisées dans le code : t('…'), tr('…'), <T k="…" /> et les libellés ternaires de t(a ? '…' : '…').
function sources(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return e.name === 'node_modules' || e.name.startsWith('.') ? [] : sources(p);
    return /\.(ts|tsx)$/.test(e.name) && !/\.test\.|\.d\.ts$|^ar\.ts$/.test(e.name) ? [p] : [];
  });
}

function cles(): Map<string, string> {
  const trouvees = new Map<string, string>();
  const racine = path.resolve(__dirname, '..');
  const fichiers = [...sources(path.join(racine, 'app')), ...sources(path.join(racine, 'lib'))];
  for (const f of fichiers) {
    const src = fs.readFileSync(f, 'utf8');
    for (const m of src.matchAll(/(?<![\w.$])(?:t|tr)\(\s*(?:[\w.]+ > 1 \? )?'((?:[^'\\]|\\.)*)'(?: : '((?:[^'\\]|\\.)*)')?/g)) {
      for (const k of [m[1], m[2]]) if (k) trouvees.set(k.replace(/\\'/g, "'"), f);
    }
    for (const m of src.matchAll(/<T k="([^"]+)"/g)) trouvees.set(m[1], f);
  }
  return trouvees;
}

describe('traduction FR → AR', () => {
  it('chaque texte traduit dans le code a son entrée arabe', () => {
    const manquantes = [...cles()].filter(([k]) => !(k in AR)).map(([k, f]) => `${path.basename(f)}: ${k}`);
    expect(manquantes).toEqual([]);
  });

  it('les {valeurs} sont les mêmes en français et en arabe', () => {
    const vars = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
    const faux = Object.entries(AR).filter(([fr, ar]) => vars(fr).join() !== vars(ar).join()).map(([fr]) => fr);
    expect(faux).toEqual([]);
  });

  it('remplit les valeurs ; texte inconnu = français', () => {
    expect(remplir('{n} articles', { n: 3 })).toBe('3 articles');
    const t = traducteur(AR);
    expect(t('Fermer')).toBe(AR['Fermer']);
    expect(t('Texte absent {x}', { x: 1 })).toBe('Texte absent 1');
    expect(traducteur(null)('Fermer')).toBe('Fermer');
  });
});
