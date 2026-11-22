import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { dossierVille, LivreurSchema } from './livreur';

// Vérifie les vrais fichiers des clients et des villes (ignore LIVREUR_FILE / DATA_DIR des tests).
const racine = path.resolve(__dirname, '..');
const lire = (f: string) => JSON.parse(fs.readFileSync(path.join(racine, f), 'utf8'));
const clients = fs.readdirSync(path.join(racine, 'clients'));
const villes = fs.readdirSync(path.join(racine, 'villes'));

describe.each(clients)('client %s', (client) => {
  it('livreur.json est valide et sa ville a des données', () => {
    const r = LivreurSchema.safeParse(lire(`clients/${client}/livreur.json`));
    expect(r.success, r.success ? '' : JSON.stringify(r.error.issues)).toBe(true);
    if (r.success) expect(villes).toContain(dossierVille(r.data.ville));
  });
  it('le nom du client peut servir de nom de projet Pages', () => expect(client).toMatch(/^[a-z0-9][a-z0-9-]{0,57}$/));
});

describe.each(villes)('ville %s', (ville) => {
  it('contient des restos, chacun avec un menu non vide', { timeout: 30_000 }, () => {
    const restos: { id: number; slug: string }[] = lire(`villes/${ville}/restos.json`);
    expect(restos.length).toBeGreaterThan(0);
    for (const r of restos) expect(lire(`villes/${ville}/menus/${r.id}.json`).plats.length, r.slug).toBeGreaterThan(0);
  });
  it('les slugs sont uniques et sûrs pour une URL (sinon un resto devient inaccessible)', () => {
    const slugs = lire(`villes/${ville}/restos.json`).map((r: { slug: string }) => r.slug);
    expect(slugs.length - new Set(slugs).size).toBe(0);
    for (const s of slugs) expect(s).toMatch(/^[a-z0-9-]{1,120}$/);
  });
});
