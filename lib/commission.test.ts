import { describe, expect, it } from 'vitest';
import { CommissionSchema, commissionMil, etiquettePlat, etiquettePromo, meilleurePromo, partRestoPourcent, pourcentCommission, PromoSchema, repartirRemise, type Promo } from './commission';

describe('pourcentCommission : un % par resto', () => {
  // Les anciens niveaux (tous, menu, plat) d’une config existante sont ignorés.
  const c = CommissionSchema.parse({ tous: 5, restos: { r: 10 }, categories: { r: { 7: 15 } }, plats: { r: { 42: 20 } } });
  it('le % du resto, sinon 0', () => {
    expect(pourcentCommission(c, 'r')).toBe(10);
    expect(pourcentCommission(c, 'autre')).toBe(0);
    expect(pourcentCommission(undefined, 'r')).toBe(0);
  });
  it('commission d’une ligne en millimes', () => expect(commissionMil(9900, 10)).toBe(990));
});

describe('promos', () => {
  const promo = (p: Partial<Promo>): Promo => PromoSchema.parse({ id: 'abcd', nom: 'Promo', type: 'pourcent', valeur: 10, financeur: 'livreur', ...p });
  it('pourcentage avec plafond, montant fixe, remise ≤ panier', () => {
    expect(meilleurePromo([promo({ valeur: 20 })], 'r', 20000)?.remiseMil).toBe(4000);
    expect(meilleurePromo([promo({ valeur: 20, max: 3 })], 'r', 20000)?.remiseMil).toBe(3000);
    expect(meilleurePromo([promo({ type: 'montant', valeur: 5 })], 'r', 20000)?.remiseMil).toBe(5000);
    expect(meilleurePromo([promo({ type: 'montant', valeur: 50 })], 'r', 20000)?.remiseMil).toBe(20000);
  });
  it('panier minimum et resto ciblé', () => {
    expect(meilleurePromo([promo({ min: 30 })], 'r', 20000)).toBeNull();
    expect(meilleurePromo([promo({ resto: 'x' })], 'r', 20000)).toBeNull();
    expect(meilleurePromo([promo({ resto: 'r' })], 'r', 20000)).not.toBeNull();
  });
  it('une seule promo : la plus avantageuse', () => {
    const r = meilleurePromo([promo({ id: 'aaaa', valeur: 5 }), promo({ id: 'bbbb', valeur: 15 })], 'r', 20000);
    expect(r?.promo.id).toBe('bbbb');
  });
  it('financement : livreur 0 %, resto 100 %, partagé = part du resto', () => {
    expect(partRestoPourcent(promo({ financeur: 'livreur' }))).toBe(0);
    expect(partRestoPourcent(promo({ financeur: 'resto' }))).toBe(100);
    expect(partRestoPourcent(promo({ financeur: 'partage', partResto: 40 }))).toBe(40);
    expect(() => promo({ financeur: 'partage' })).toThrow();
  });
  it('répartition : somme exacte, part du resto plafonnée à ce qui lui reste', () => {
    expect(repartirRemise(3000, 40, 100000)).toEqual({ restoMil: 1200, livreurMil: 1800 });
    expect(repartirRemise(3333, 50, 100000)).toEqual({ restoMil: 1667, livreurMil: 1666 });
    expect(repartirRemise(5000, 100, 2000)).toEqual({ restoMil: 2000, livreurMil: 3000 });
  });
});

describe('etiquettePromo (badge du resto)', () => {
  const p = (x: Partial<Promo>) => PromoSchema.parse({ id: 'abcd', nom: 'Promo', type: 'pourcent', valeur: 10, financeur: 'livreur', ...x });
  it('aucune promo applicable : null', () => {
    expect(etiquettePromo([], 'r')).toBeNull();
    expect(etiquettePromo([p({ resto: 'x' })], 'r')).toBeNull();
  });
  it('texte en % ou en DT, avec le panier minimum', () => {
    expect(etiquettePromo([p({})], 'r')?.texte).toBe('−10 %');
    expect(etiquettePromo([p({ type: 'montant', valeur: 2.5, min: 15 })], 'r')?.texte).toBe('−2,5 DT dès 15 DT');
  });
  it('la promo du resto passe avant la générale, le % avant le DT', () => {
    expect(etiquettePromo([p({ valeur: 30 }), p({ nom: 'Local', valeur: 5, resto: 'r' })], 'r')?.nom).toBe('Local');
    expect(etiquettePromo([p({ type: 'montant', valeur: 50, nom: 'DT' }), p({ nom: 'Pct', valeur: 5 })], 'r')?.nom).toBe('Pct');
  });
});

describe('promo sur un seul plat', () => {
  const p = (x: Partial<Promo>) => PromoSchema.parse({ id: 'abcd', nom: 'Promo', type: 'pourcent', valeur: 10, financeur: 'livreur', resto: 'r', plat: 7, ...x });
  it('la remise ne porte que sur ce plat, pas sur le panier', () => {
    expect(meilleurePromo([p({})], 'r', 30000, { 7: 10000, 8: 20000 })?.remiseMil).toBe(1000);
    expect(meilleurePromo([p({})], 'r', 20000, { 8: 20000 })).toBeNull(); // le plat n’est pas dans le panier
  });
  it('plafond et minimum se comptent sur la ligne du plat', () => {
    expect(meilleurePromo([p({ type: 'montant', valeur: 50 })], 'r', 30000, { 7: 10000 })?.remiseMil).toBe(10000);
    expect(meilleurePromo([p({ min: 15 })], 'r', 30000, { 7: 10000 })).toBeNull();
  });
  it('une promo sur un plat demande son resto', () => expect(() => p({ resto: undefined })).toThrow());
  it('badges : resto = « plats en promo » s’il n’y a que ça ; le plat a son badge, les autres non', () => {
    expect(etiquettePromo([p({})], 'r', 'dès', 'Plats en promo')?.texte).toBe('Plats en promo');
    expect(etiquettePlat([p({})], 'r', 7)?.texte).toBe('−10 %');
    expect(etiquettePlat([p({})], 'r', 8)).toBeNull();
  });
});
