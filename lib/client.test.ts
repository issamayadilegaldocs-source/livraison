import { describe, expect, it } from 'vitest';
import { lireClient } from './client';

describe('lireClient', () => {
  const ok = { nom: 'Sami Ben Ali', tel: '22 123 456', adresse: 'Rue de la Mosquée, 2e étage', position: { lat: 36.8, lng: 10.18, label: 'Rue de la Mosquée' } };

  it('relit les coordonnées enregistrées', () => {
    expect(lireClient(JSON.stringify(ok))).toEqual(ok);
    expect(lireClient(JSON.stringify({ ...ok, position: null }))?.position).toBeNull();
  });

  it('ignore un stockage vide, abîmé ou d’un autre format', () => {
    expect(lireClient(null)).toBeNull();
    expect(lireClient('{pas du json')).toBeNull();
    expect(lireClient(JSON.stringify({ nom: 'Sami' }))).toBeNull();
    expect(lireClient(JSON.stringify({ ...ok, position: { lat: '36' } }))).toBeNull();
  });
});
