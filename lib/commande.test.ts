import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { Menu, RestoIndex } from './catalogue';
import {
  calculerCommande,
  CommandeInputSchema,
  formaterPrix,
  messageCommande,
  messageWhatsApp,
  normaliserTelephone,
  originePosition,
  type CommandeInput,
} from './commande';
import { mapMenu, mapResto } from './import-dump.mjs';
import { getLivreur } from './livreur';

const DUMP = path.join(__dirname, '..', 'test', 'fixtures', 'dump');
const lire = (p: string) => JSON.parse(fs.readFileSync(path.join(DUMP, p), 'utf8'));
const produits = lire('products/1.json').products;
const resto: RestoIndex = mapResto(lire('restaurants/1.json'), produits);
const menu: Menu = mapMenu(lire('restaurants/1.json'), produits, lire('restaurants-extra/1.json'));
const livreur = getLivreur(); // livraison : 2 DT + 0,8 DT/km × 1,3, min 3, max 12, rayon 15 km
const OUVERT = new Date('2026-11-16T12:00:00+01:00'); // lundi midi
const FERME = new Date('2026-11-16T23:00:00+01:00');

const cordonBleu = menu.plats.find((p) => p.id === 534)!;
const TAILLE = cordonBleu.groupes.findIndex((g) => g.nom.includes('Taille'));
const XL = cordonBleu.groupes[TAILLE].options.findIndex((o) => o.label === 'XL Baguette');
// client à 3 km plein nord du resto → 3,9 km route → 2 + 3,12 = 5,12 → 5,5 DT
const A_3KM = { lat: resto.position.lat + 3 / 111.195, lng: resto.position.lng };

const input = (over: Partial<CommandeInput> = {}): CommandeInput => ({
  restoSlug: 'baguette-baguette',
  lignes: [{ platId: 534, qte: 2, choix: { [TAILLE]: [XL] } }],
  client: { nom: 'Sami Ben Ali', telephone: '22 123 456', adresse: '3 rue de Rome, Sfax', note: 'Sonner 2 fois' },
  position: A_3KM,
  ...over,
});
const calc = (i: CommandeInput, t = OUVERT) => calculerCommande(livreur, resto, menu, CommandeInputSchema.parse(i), t);

describe('normaliserTelephone', () => {
  it.each([
    ['22 123 456', '21622123456'],
    ['+216 22123456', '21622123456'],
    ['0021622123456', '21622123456'],
  ])('%s → %s', (raw, out) => expect(normaliserTelephone(raw)).toBe(out));
  it('refuse un numéro invalide', () => expect(normaliserTelephone('123')).toBeNull());
});

describe('CommandeInputSchema', () => {
  it.each([0, 51, 1.5])('rejette qte=%s', (qte) => {
    expect(CommandeInputSchema.safeParse(input({ lignes: [{ platId: 534, qte, choix: {} }] })).success).toBe(false);
  });
  it('rejette un panier vide', () => expect(CommandeInputSchema.safeParse(input({ lignes: [] })).success).toBe(false));
  it('exige la position du client', () => {
    const { position, ...sans } = input();
    expect(CommandeInputSchema.safeParse(sans).success).toBe(false);
  });
  it('rejette des coordonnées impossibles', () =>
    expect(CommandeInputSchema.safeParse(input({ position: { lat: 200, lng: 0 } })).success).toBe(false));
  it('accepte une ligne sans choix', () =>
    expect(CommandeInputSchema.safeParse(input({ lignes: [{ platId: 582, qte: 1 }] })).success).toBe(true));
});

describe('calculerCommande', () => {
  it('compte les options payantes et les frais', () => {
    const c = calc(input());
    if ('erreur' in c) throw new Error(c.erreur);
    expect(c.lignes[0].sousTotal).toBe(27.6); // (8.9 + 4.9) × 2
    expect(c.frais).toBe(5.5);
    expect(c.km).toBe(3.9);
    expect(c.total).toBe(33.1);
    expect(c.lignes[0].options).toBe('XL Baguette');
  });
  it('refuse une option obligatoire manquante', () => {
    const c = calc(input({ lignes: [{ platId: 534, qte: 1, choix: {} }] }));
    expect(c).toEqual({ erreur: expect.stringContaining('Choisissez') });
  });
  it('refuse un resto fermé avec un message clair', () => {
    const c = calc(input(), FERME);
    expect(c).toEqual({ erreur: expect.stringMatching(/^Baguette & Baguette est fermé\. Fermé · ouvre/) });
  });
  it('refuse une adresse hors zone', () => {
    const loin = { lat: resto.position.lat + 12 / 111.195, lng: resto.position.lng };
    expect(calc(input({ position: loin }))).toEqual({ erreur: expect.stringContaining('trop loin') });
  });
  it('refuse un plat inconnu', () => expect(calc(input({ lignes: [{ platId: 999999, qte: 1 }] }))).toHaveProperty('erreur'));
  it('refuse un téléphone invalide', () =>
    expect(calc(input({ client: { ...input().client, telephone: '12345678901' } }))).toHaveProperty('erreur'));
});

describe('formaterPrix', () => {
  it('formate en DT', () => expect(formaterPrix(12.5)).toBe('12,500 DT'));
});

describe('origine de la position client', () => {
  it('GPS : la précision va jusqu au message du livreur', () => {
    const c = calc(input({ position: { ...A_3KM, precision: 35 } }));
    if ('erreur' in c) throw new Error(c.erreur);
    expect(c.position.precision).toBe(35);
    expect(messageCommande(c, livreur)).toContain('Position (GPS du téléphone, ± 35 m)');
  });
  it('carte : pas de précision, indiqué comme point choisi', () => {
    expect(originePosition({})).toBe('point choisi sur la carte');
    expect(CommandeInputSchema.safeParse(input({ position: { ...A_3KM, precision: -1 } })).success).toBe(false);
  });
});

describe('messageCommande', () => {
  const c = calc(input());
  if ('erreur' in c) throw new Error(c.erreur);
  const m = messageCommande(c, livreur);
  it('contient resto, plats, options, total et client', () => {
    expect(m).toContain('Baguette & Baguette');
    expect(m).toContain(resto.telephone);
    expect(m).toContain('2 × Sandwich Cordon Bleu = 27,600 DT');
    expect(m).toContain('   + XL Baguette');
    expect(m).toContain('Livraison : 5,500 DT (3,9 km)');
    expect(m).toContain('TOTAL : 33,100 DT');
    expect(m).toContain(`https://www.google.com/maps?q=${A_3KM.lat.toFixed(6)},${A_3KM.lng.toFixed(6)}`);
    expect(m).toContain(`https://www.google.com/maps?q=${resto.position.lat.toFixed(6)},${resto.position.lng.toFixed(6)}`);
    expect(m).toContain('+216 22 123 456');
    expect(m).toContain('Sonner 2 fois');
  });
});


describe('messageWhatsApp', () => {
  const c = calc(input());
  if ('erreur' in c) throw new Error(c.erreur);
  const m = messageWhatsApp(c, livreur, 'AB12CD', 'https://exemple.tn/bon/AB12CD-x');
  it('met en forme pour WhatsApp (gras, emojis, sections)', () => {
    expect(m).toContain('🛵 *NOUVELLE COMMANDE N° AB12CD*');
    expect(m).toContain('🏪 *Baguette & Baguette*');
    expect(m).toContain('▪️ 2× Sandwich Cordon Bleu — 27,600 DT');
    expect(m).toContain('   _+ XL Baguette_');
    expect(m).toContain('💵 *TOTAL : 33,100 DT*');
    expect(m).toContain('👤 *Sami Ben Ali*');
    expect(m).toContain('📞 +216 22 123 456');
  });
  it('contient le lien du bon pour le resto et les liens Maps', () => {
    expect(m).toContain('🧾 Bon à transférer au resto :\nhttps://exemple.tn/bon/AB12CD-x');
    expect(m).toContain('https://www.google.com/maps?q=');
  });
  it('sans lien de bon, la ligne n’apparaît pas', () => expect(messageWhatsApp(c, livreur, 'AB12CD', null)).not.toContain('Bon à transférer'));
});
