// npm run deploy-tous [-- <client> ...] [--sans-images]
// Pour chaque client de ../secrets/clients.json (hors git) : envoie les images manquantes sur son R2, puis déploie son site.
// Un client en erreur n'arrête pas les autres ; le résumé final liste les échecs.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';

const FICHIER = '../secrets/clients.json';
const args = process.argv.slice(2);
const sansImages = args.includes('--sans-images');
const choisis = args.filter((a) => !a.startsWith('--'));

if (!fs.existsSync(FICHIER)) {
  console.error(`Fichier absent : ${FICHIER}`);
  process.exit(1);
}
const tous = JSON.parse(fs.readFileSync(FICHIER, 'utf8'));
const inconnus = choisis.filter((c) => !tous[c]);
if (inconnus.length) {
  console.error(`Client absent de ${FICHIER} : ${inconnus.join(', ')}`);
  process.exit(1);
}

const echecs = [];
for (const [client, cles] of Object.entries(tous)) {
  if (choisis.length && !choisis.includes(client)) continue;
  if (Object.values(cles).some((v) => !v || String(v).includes('A_REMPLIR'))) {
    echecs.push(`${client} : clés à remplir`);
    continue;
  }
  console.log(`\n=== ${client} ===`);
  const env = { ...process.env, ...cles, CLIENT: client };
  const etapes = [...(sansImages ? [] : [['node', 'scripts/envoyer-images.mjs']]), ['node', 'scripts/deploy.mjs', client]];
  for (const [cmd, ...a] of etapes) {
    if (spawnSync(cmd, a, { stdio: 'inherit', env }).status !== 0) {
      echecs.push(`${client} : échec (${a.join(' ')})`);
      break;
    }
  }
}
console.log(echecs.length ? `\nÉchecs :\n- ${echecs.join('\n- ')}` : '\nTous les clients sont à jour.');
process.exit(echecs.length ? 1 : 0);
