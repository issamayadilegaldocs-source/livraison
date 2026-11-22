// npm run deploy -- <client>   →  build statique du client + wrangler pages deploy (projet Pages = <client>).
// Les images ne sont jamais dans le build : elles sont servies par le bucket R2 (MEDIA_BASE_URL, URL absolue).
// --dry-run : build seulement, sans envoi.
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import { choisirClient } from './preparer.mjs';

const args = process.argv.slice(2);
const essai = args.includes('--dry-run');
const client = args.find((a) => !a.startsWith('--'));
if (!client) {
  console.error('Usage : npm run deploy -- <client> [--dry-run]   (client = dossier dans clients/)');
  process.exit(1);
}
if (!/^[a-z0-9][a-z0-9-]{0,57}$/.test(client)) {
  console.error('Nom de client invalide : minuscules, chiffres et tirets (c’est aussi le nom du projet Pages).');
  process.exit(1);
}
try {
  choisirClient({ CLIENT: client }); // erreur claire si le dossier n'existe pas
} catch (e) {
  console.error(e.message);
  process.exit(1);
}

// .env.local peut contenir MEDIA_BASE_URL=/media (dev) : on impose une URL absolue pour la prod.
const media = process.env.MEDIA_BASE_URL_PROD || 'https://livreur.hamma-delivery.com/media';
if (!/^https:\/\//.test(media)) {
  console.error(`MEDIA_BASE_URL_PROD doit être une URL https (reçu : ${media}).`);
  process.exit(1);
}

const env = { ...process.env, CLIENT: client, MEDIA_BASE_URL: media };
const run = (cmd) => execSync(cmd, { stdio: 'inherit', env });

fs.rmSync('out', { recursive: true, force: true });
run('npm run build');
if (fs.existsSync('out/media')) {
  console.error('out/media existe : les images ne doivent pas être dans le build (limite Pages : 20 000 fichiers).');
  process.exit(1);
}
// Les .txt RSC (un par page) ne servent qu'à next/link ; les liens sont des <a> (app/components/Lien.tsx).
// On les retire : ~300 fichiers et plusieurs Mo en moins à envoyer.
(function retirerRsc(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const f = `${d}/${e.name}`;
    if (e.isDirectory()) retirerRsc(f);
    else if (e.name.endsWith('.txt') && fs.existsSync(f.replace(/\.txt$/, '.html'))) fs.rmSync(f);
  }
})('out');
if (essai) {
  console.log(`Build prêt dans out/ pour ${client} (--dry-run : rien envoyé).`);
  process.exit(0);
}
run(`npx wrangler pages deploy out --project-name ${client} --branch main --commit-dirty=true`);
