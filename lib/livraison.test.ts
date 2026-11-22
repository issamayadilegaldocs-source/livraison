import { describe, expect, it } from 'vitest';
import { calculerLivraison, departCarte, distanceKm, positionPrecise, type ConfLivraison } from './livraison';

const conf: ConfLivraison = { base: 2, parKm: 0.8, min: 3, max: 12, rayonMaxKm: 15, facteurRoute: 1.3 };
// ~1 km plein nord = 1/111.195 degré de latitude
const nordDe = (km: number) => ({ lat: 34.74 + km / 111.195, lng: 10.76 });
const resto = { lat: 34.74, lng: 10.76 };

describe('distanceKm', () => {
  it('1° de latitude ≈ 111,2 km', () => expect(distanceKm({ lat: 0, lng: 0 }, { lat: 1, lng: 0 })).toBeCloseTo(111.19, 1));
  it('0 pour le même point', () => expect(distanceKm(resto, resto)).toBe(0));
});

describe('calculerLivraison', () => {
  it('applique le minimum sur une courte distance', () => {
    expect(calculerLivraison(conf, resto, nordDe(0.5))).toEqual({ km: 0.7, frais: 3 });
  });
  it('base + prix/km sur la distance route (× 1,3), arrondi au 0,5 DT supérieur', () => {
    // 3 km à vol d'oiseau → 3,9 km route → 2 + 3,12 = 5,12 → 5,5
    expect(calculerLivraison(conf, resto, nordDe(3))).toEqual({ km: 3.9, frais: 5.5 });
  });
  it('tarif du livreur : 1 DT + 0,5 DT/km', () => {
    // 3,9 km route → 1 + 1,95 = 2,95 → 3
    expect(calculerLivraison({ ...conf, base: 1, parKm: 0.5, min: 1 }, resto, nordDe(3))).toEqual({ km: 3.9, frais: 3 });
  });
  it('plafonne au maximum', () => {
    expect(calculerLivraison(conf, resto, nordDe(10))).toEqual({ km: 13, frais: 12 });
  });
  it('refuse au-delà du rayon (sur la distance route)', () => {
    expect(calculerLivraison(conf, resto, nordDe(12))).toEqual({ erreur: expect.stringContaining('15 km') });
  });
});

describe('positionPrecise', () => {
  it('accepte un GPS précis (≤ 150 m)', () => expect(positionPrecise(25)).toBe(true));
  it('refuse une position IP / Wi-Fi imprécise', () => expect(positionPrecise(4000)).toBe(false));
  it('limite exacte à 150 m', () => {
    expect(positionPrecise(150)).toBe(true);
    expect(positionPrecise(151)).toBe(false);
  });
});

describe('departCarte', () => {
  const resto = { lat: 34.74, lng: 10.76 };
  it('GPS précis → accepté directement', () => {
    expect(departCarte({ lat: 34.75, lng: 10.76, precision: 40 }, resto)).toEqual({ accepter: true, centre: { lat: 34.75, lng: 10.76 } });
  });
  it('GPS imprécis mais dans la ville → carte centrée sur la position approximative', () => {
    expect(departCarte({ lat: 34.75, lng: 10.76, precision: 600 }, resto)).toEqual({ accepter: false, centre: { lat: 34.75, lng: 10.76 } });
  });
  it('position IP loin de la ville (Tunis) → carte centrée sur le resto', () => {
    expect(departCarte({ lat: 36.73, lng: 10.32, precision: 4000 }, resto)).toEqual({ accepter: false, centre: resto });
  });
  it('aucune position → carte centrée sur le resto', () => expect(departCarte(null, resto)).toEqual({ accepter: false, centre: resto }));
});
