import { describe, expect, it } from 'vitest';
import { dossierVille, getLivreur, LivreurSchema } from './livreur';

describe('getLivreur', () => {
  it('charge livreur.json', () => {
    expect(getLivreur().ville).toBe('Sfax');
  });
});

describe('LivreurSchema', () => {
  const base = () => ({ ...getLivreur() });
  it('rejette une couleur non hex', () => {
    expect(LivreurSchema.safeParse({ ...base(), couleur: 'red' }).success).toBe(false);
  });
  it('rejette un WhatsApp invalide', () => {
    expect(LivreurSchema.safeParse({ ...base(), whatsapp: '123' }).success).toBe(false);
  });
});

describe('dossierVille', () => {
  it('donne le nom de dossier de la ville', () => {
    expect(dossierVille('Sfax')).toBe('sfax');
    expect(dossierVille('Médenine')).toBe('medenine');
    expect(dossierVille(' Sidi Bouzid ')).toBe('sidi-bouzid');
  });
});
