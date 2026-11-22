import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { importer, mapMenu, mapResto } from './import-dump.mjs';

const DUMP = path.join(__dirname, '..', 'test', 'fixtures', 'dump');
const lire = (p: string) => JSON.parse(fs.readFileSync(path.join(DUMP, p), 'utf8'));

describe('mapResto', () => {
  const r = mapResto(lire('restaurants/1.json'), lire('products/1.json').products);
  it('mappe les champs de base', () => {
    expect(r.nom).toBe('Baguette & Baguette');
    expect(r.slug).toBe('baguette-baguette');
    expect(r.note).toBe(3.2);
    expect(r.nbAvis).toBe(50);
    expect(r.horaires.find((h) => h.jour === 1)).toEqual({ jour: 1, ouvre: '11:00', ferme: '21:00' });
    expect(r.plats).toContain('Sandwich Cordon Bleu');
    expect(r.categories).toContain('Ciabatta');
    expect(r.position.lat).toBeCloseTo(34.74087, 4);
    expect(r.position.lng).toBeCloseTo(10.75769, 4);
  });
  it('resto sans schedules → horaires vides', () => {
    expect(mapResto(lire('restaurants/1112.json'), []).horaires).toEqual([]);
  });
});

describe('mapMenu', () => {
  const menu = mapMenu(lire('restaurants/1.json'), lire('products/1.json').products, lire('restaurants-extra/1.json'));
  it('mappe les groupes single obligatoires', () => {
    const plat = menu.plats.find((p) => p.id === 534)!;
    const taille = plat.groupes.find((g) => g.nom.includes('Taille'))!;
    expect(taille).toMatchObject({ type: 'single', obligatoire: true, min: 1, max: 1 });
    expect(taille.options.find((o) => o.label === 'XL Baguette')?.prix).toBe(4.9);
    expect(plat.prix).toBe(8.9);
    expect(plat.prixOrigine).toBeNull();
  });
  it('mappe les groupes multi facultatifs', () => {
    const g = menu.plats.find((p) => p.id === 582)!.groupes[0];
    expect(g).toMatchObject({ type: 'multi', obligatoire: false, min: 0, max: 4 });
  });
  it('marque les plats populaires', () => {
    expect(menu.plats.find((p) => p.id === 582)!.populaire).toBe(true);
  });
  it('ne garde que les catégories qui ont des plats, dans l’ordre du resto', () => {
    expect(menu.categories.map((c) => c.nom)).toEqual(['Ciabatta', 'Sandwich']);
  });
  it('applique les remises percent et amount', () => {
    const base = { id: 1, name: 'X', description: '', image: null, category_id: 3, variations: [], status: 1 };
    const m = mapMenu({ id: 9, categories: [{ id: 3, name: 'Sandwich' }] }, [
      { ...base, id: 1, price: 20, discount: 10, discount_type: 'percent' },
      { ...base, id: 2, price: 20, discount: 2.5, discount_type: 'amount' },
    ], {});
    expect(m.plats[0]).toMatchObject({ prix: 18, prixOrigine: 20 });
    expect(m.plats[1]).toMatchObject({ prix: 17.5, prixOrigine: 20 });
  });
  it('exclut les plats désactivés', () => {
    const m = mapMenu({ id: 9, categories: [{ id: 3, name: 'S' }] }, [
      { id: 1, name: 'X', price: 5, category_id: 3, variations: [], status: 0 },
    ], {});
    expect(m.plats).toHaveLength(0);
  });
});

describe('importer', () => {
  it('écrit restos.json, menus/<id>.json et cuisines.json ; ignore les restos sans plats', () => {
    const out = fs.mkdtempSync(path.join(os.tmpdir(), 'import-'));
    const stats = importer(DUMP, out);
    expect(stats.restos).toBe(1); // 1112 (mini market) n'a aucun plat
    const restos = JSON.parse(fs.readFileSync(path.join(out, 'restos.json'), 'utf8'));
    expect(restos.map((r: { id: number }) => r.id)).toEqual([1]);
    expect(fs.existsSync(path.join(out, 'menus', '1.json'))).toBe(true);
    expect(JSON.parse(fs.readFileSync(path.join(out, 'cuisines.json'), 'utf8'))[0]).toHaveProperty('nom');
  });
});
