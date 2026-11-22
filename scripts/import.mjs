// npm run import -- <dossier-dump-ville> <ville>  →  villes/<ville>/restos.json, menus/*.json, cuisines.json
// <ville> = nom de dossier en minuscules (ex. sfax) ; il doit correspondre au champ `ville` des livreurs
// de cette ville (`Sfax` → sfax, voir dossierVille dans lib/livreur.ts).
import path from 'node:path';
import { importer } from '../lib/import-dump.mjs';

const [dir, ville] = process.argv.slice(2);
if (!dir || !ville || !/^[a-z0-9-]+$/.test(ville)) {
  console.error('Usage : npm run import -- <dossier-dump> <ville>  (ex. C:/zigzag-data/sfax-backup/2026-10-14 sfax)');
  process.exit(1);
}
const stats = importer(path.resolve(dir), path.resolve('villes', ville));
console.log(`Import terminé : ${stats.restos} restos, ${stats.plats} plats, ${stats.cuisines} cuisines → villes/${ville}/`);
