import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { planifier } from './envoyer-images.mjs';
import { choisirClient, preparer } from './preparer.mjs';

function racineAvec(clients: string[]) {
  const r = fs.mkdtempSync(path.join(os.tmpdir(), 'clients-'));
  for (const c of clients) {
    fs.mkdirSync(path.join(r, 'clients', c), { recursive: true });
    fs.writeFileSync(path.join(r, 'clients', c, 'livreur.json'), JSON.stringify({ nom: c }));
  }
  return r;
}

describe('choisirClient / preparer', () => {
  it('prend le seul client présent sans CLIENT', () => expect(choisirClient({}, racineAvec(['ali']))).toBe('ali'));
  it('exige CLIENT quand il y a plusieurs clients', () => {
    const r = racineAvec(['ali', 'sami']);
    expect(() => choisirClient({}, r)).toThrow(/CLIENT/);
    expect(choisirClient({ CLIENT: 'sami' }, r)).toBe('sami');
  });
  it('refuse un client inconnu', () => expect(() => choisirClient({ CLIENT: 'x' }, racineAvec(['ali']))).toThrow(/inconnu/));
  it('copie la config du client dans .build/livreur.json (jamais celle d’un autre)', () => {
    const r = racineAvec(['ali', 'sami']);
    preparer({ CLIENT: 'sami' }, r);
    expect(JSON.parse(fs.readFileSync(path.join(r, '.build', 'livreur.json'), 'utf8')).nom).toBe('sami');
  });
  it('refuse deux clients avec le même whatsapp (config en ligne partagée)', () => {
    const r = racineAvec(['ali', 'sami']);
    for (const c of ['ali', 'sami']) fs.writeFileSync(path.join(r, 'clients', c, 'livreur.json'), JSON.stringify({ nom: c, whatsapp: '21612345678' }));
    expect(() => preparer({ CLIENT: 'sami' }, r)).toThrow(/même whatsapp/);
    fs.writeFileSync(path.join(r, 'clients', 'ali', 'livreur.json'), JSON.stringify({ nom: 'ali', whatsapp: '21687654321' }));
    expect(() => preparer({ CLIENT: 'sami' }, r)).not.toThrow();
  });
});

describe('planifier (envoi des images vers R2)', () => {
  const f = (cle: string, taille: number) => ({ cle, chemin: cle, taille });
  it('n’envoie que les images absentes du bucket', () => {
    const { aEnvoyer, conflits } = planifier([f('product/thumb/a.webp', 10), f('product/thumb/b.webp', 20)], new Map([['product/thumb/a.webp', 10]]));
    expect(aEnvoyer.map((x) => x.cle)).toEqual(['product/thumb/b.webp']);
    expect(conflits).toEqual([]);
  });
  it('signale une clé déjà présente avec une autre taille (deux villes, même nom)', () => {
    expect(planifier([f('product/full/a.webp', 10)], new Map([['product/full/a.webp', 99]])).conflits).toEqual(['product/full/a.webp']);
  });
});
