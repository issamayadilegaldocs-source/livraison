import { describe, expect, it } from 'vitest';
import { lireResultat, urlInverse, urlRecherche } from './geocodage';

const SFAX = { lat: 34.74, lng: 10.76 };

describe('urlRecherche', () => {
  const u = new URL(urlRecherche('rue de Rome', SFAX));
  it('cherche en Tunisie, en français, avec les détails d’adresse', () => {
    expect(u.origin + u.pathname).toBe('https://nominatim.openstreetmap.org/search');
    expect(u.searchParams.get('q')).toBe('rue de Rome');
    expect(u.searchParams.get('countrycodes')).toBe('tn');
    expect(u.searchParams.get('accept-language')).toBe('fr');
    expect(u.searchParams.get('addressdetails')).toBe('1');
    expect(u.searchParams.get('format')).toBe('jsonv2');
  });
  it('privilégie la zone autour de la ville (viewbox ± 0,25°)', () => {
    expect(u.searchParams.get('viewbox')).toBe('10.51,34.99,11.01,34.49');
  });
});

describe('urlInverse', () => {
  it('demande l’adresse d’un point', () => {
    const u = new URL(urlInverse({ lat: 34.7401234, lng: 10.7609876 }));
    expect(u.pathname).toBe('/reverse');
    expect(u.searchParams.get('lat')).toBe('34.740123');
    expect(u.searchParams.get('lon')).toBe('10.760988');
    expect(u.searchParams.get('zoom')).toBe('18');
  });
});

describe('lireResultat', () => {
  it('donne un libellé court (numéro + rue) et le quartier / ville en détail', () => {
    const r = lireResultat({
      lat: '34.7401',
      lon: '10.7609',
      display_name: '12, Rue de Rome, Sfax Médina, Sfax, 3000, Tunisie',
      address: { house_number: '12', road: 'Rue de Rome', suburb: 'Sfax Médina', city: 'Sfax', postcode: '3000', country: 'Tunisie' },
    });
    expect(r).toEqual({ label: '12 Rue de Rome', detail: 'Sfax Médina, Sfax', point: { lat: 34.7401, lng: 10.7609 } });
  });
  it('sans rue, reprend le début du nom complet', () => {
    const r = lireResultat({ lat: '34.8', lon: '10.7', display_name: 'Sakiet Ezzit, Délégation Sakiet Ezzit, Sfax, Tunisie', address: {} });
    expect(r.label).toBe('Sakiet Ezzit');
    expect(r.detail).toBe('Délégation Sakiet Ezzit, Sfax');
  });
});
