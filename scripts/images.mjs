// npm run images -- <ville> <dossier-images-dump>
// Compresse en webp (thumb 400px, full 1000px) les seules images référencées par villes/<ville>/, dans media/
// (hors de public/ : elles ne doivent jamais partir dans le build Pages). Relançable : les fichiers déjà
// produits sont ignorés. Ensuite : `npm run envoyer-images` (bucket R2 partagé par toutes les copies).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const TAILLES = { thumb: { width: 400, quality: 70 }, full: { width: 1000, quality: 75 } };

/** @returns {Promise<'fait'|'ignore'|'manquant'|'erreur'>} */
export async function optimiser(src, outDir, type, fichier) {
  const nom = fichier.replace(/\.[^.]*$/, '') + '.webp'; // idem lib/media.ts : « xxx. » → xxx.webp
  const cibles = Object.keys(TAILLES).map((t) => path.join(outDir, type, t, nom));
  if (cibles.every((c) => fs.existsSync(c))) return 'ignore';
  if (!fs.existsSync(src)) return 'manquant';
  try {
    for (const [t, o] of Object.entries(TAILLES)) {
      const cible = path.join(outDir, type, t, nom);
      fs.mkdirSync(path.dirname(cible), { recursive: true });
      await sharp(src).rotate().resize({ width: o.width, withoutEnlargement: true }).webp({ quality: o.quality }).toFile(cible);
    }
    return 'fait';
  } catch {
    return 'erreur';
  }
}

function references(dataDir) {
  const lire = (f) => JSON.parse(fs.readFileSync(path.join(dataDir, f), 'utf8'));
  const refs = [];
  // [type de sortie, fichier, sous-dossier source dans le dump] — les couvertures sont dans restaurant/cover/
  for (const r of lire('restos.json')) {
    if (r.logo) refs.push(['restaurant', r.logo, 'restaurant']);
    if (r.couverture) refs.push(['restaurant', r.couverture, 'restaurant/cover']);
  }
  for (const c of lire('cuisines.json')) if (c.image) refs.push(['cuisine', c.image, 'cuisine']);
  for (const f of fs.readdirSync(path.join(dataDir, 'menus'))) {
    for (const p of lire(path.join('menus', f)).plats) if (p.image) refs.push(['product', p.image, 'product']);
  }
  return refs;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const [ville, src] = process.argv.slice(2);
  if (!ville || !src) {
    console.error('Usage : npm run images -- <ville> <dossier-images-dump>  (ex. sfax C:/catalogue-data/sfax-backup/images)');
    process.exit(1);
  }
  const out = 'media';
  const refs = references(path.resolve('villes', ville));
  const file = [...refs];
  const stats = { fait: 0, ignore: 0, manquant: 0, erreur: 0 };
  let n = 0;
  const worker = async () => {
    for (let ref = file.shift(); ref; ref = file.shift()) {
      const [type, f, sous] = ref;
      stats[await optimiser(path.join(src, sous, f), path.resolve(out), type, f)]++;
      if (++n % 500 === 0) console.log(`${n}/${refs.length}`, stats);
    }
  };
  await Promise.all(Array.from({ length: 4 }, worker));
  console.log('Images terminées :', stats);
}
