import { describe, expect, it } from 'vitest';
import { distanceEnKm, formaterDistance, lienGoogleMaps, prochaineEtape } from './admin-utils';

describe('admin-utils (dispatch distance & étapes)', () => {
  it('calcule la distance Haversine entre deux points à Sfax', () => {
    const km = distanceEnKm({ lat: 34.7406, lng: 10.7603 }, { lat: 34.8008, lng: 10.761 });
    expect(km).toBeGreaterThan(6);
    expect(km).toBeLessThan(7);
  });

  it('formate la distance lisiblement (mètres, km, GPS off)', () => {
    expect(formaterDistance(null)).toBe('GPS off');
    expect(formaterDistance(0.32)).toBe('à 300 m');
    expect(formaterDistance(2.46)).toBe('à 2,5 km');
  });

  it('propose la bonne étape suivante pour chaque statut', () => {
    expect(prochaineEtape('nouvelle')?.cle).toBe('confirmee');
    expect(prochaineEtape('confirmee')?.cle).toBe('en_preparation');
    expect(prochaineEtape('en_preparation')?.cle).toBe('en_livraison');
    expect(prochaineEtape('en_livraison')?.cle).toBe('livree');
    expect(prochaineEtape('livree')).toBeNull();
  });

  it('construit un lien Google Maps itinéraire avec coordonnées ou adresse', () => {
    expect(lienGoogleMaps('Sfax', { lat: 34.74, lng: 10.76 })).toContain('destination=34.74,10.76');
    expect(lienGoogleMaps('Route Gremda')).toContain('query=Route%20Gremda');
  });
});
