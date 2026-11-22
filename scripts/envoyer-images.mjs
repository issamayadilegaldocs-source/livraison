// npm run envoyer-images [-- --dry-run]
// Envoie media/ (sortie de `npm run images`) dans le bucket R2 partagé par toutes les copies, clés plates
// `<type>/<taille>/<nom>.webp` (les noms du dump, `AAAA-MM-JJ-<id unique>`, sont uniques).
// Idempotent : liste le bucket une fois et n'envoie que ce qui manque. Une clé déjà présente avec une
// taille différente arrête tout (deux villes avec le même nom d'image) au lieu d'écraser en silence.
// Variables (.env.local, jamais commité) : R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** Fichiers locaux à envoyer : { cle, chemin, taille }. */
export function fichiersLocaux(racine) {
  const liste = [];
  const parcourir = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) parcourir(p);
      else if (e.name.endsWith('.webp')) liste.push({ cle: path.relative(racine, p).split(path.sep).join('/'), chemin: p, taille: fs.statSync(p).size });
    }
  };
  if (fs.existsSync(racine)) parcourir(racine);
  return liste;
}

/** Ce qu'il faut envoyer, et les conflits (même clé, taille différente). `distants` : Map clé → taille. */
export function planifier(locaux, distants) {
  const aEnvoyer = [];
  const conflits = [];
  for (const f of locaux) {
    if (!distants.has(f.cle)) aEnvoyer.push(f);
    else if (distants.get(f.cle) !== f.taille) conflits.push(f.cle);
  }
  return { aEnvoyer, conflits };
}

async function main() {
  const essai = process.argv.includes('--dry-run');
  const env = { ...lireEnvLocal(), ...process.env };
  const manque = ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET'].filter((k) => !env[k]);
  if (manque.length) {
    console.error(`Variables manquantes (.env.local) : ${manque.join(', ')}. Clés : dashboard Cloudflare → R2 → Manage API tokens.`);
    process.exit(1);
  }
  const { AwsClient } = await import('aws4fetch');
  const s3 = new AwsClient({ accessKeyId: env.R2_ACCESS_KEY_ID, secretAccessKey: env.R2_SECRET_ACCESS_KEY, service: 's3', region: 'auto' });
  const base = `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${env.R2_BUCKET}`;

  // Liste du bucket (1 000 clés par page)
  const distants = new Map();
  let jeton = '';
  do {
    const q = new URLSearchParams({ 'list-type': '2', 'max-keys': '1000', ...(jeton && { 'continuation-token': jeton }) });
    const res = await s3.fetch(`${base}?${q}`);
    if (!res.ok) throw new Error(`Liste R2 refusée : ${res.status} ${(await res.text()).slice(0, 200)}`);
    const xml = await res.text();
    for (const m of xml.matchAll(/<Contents>[\s\S]*?<Key>([^<]+)<\/Key>[\s\S]*?<Size>(\d+)<\/Size>[\s\S]*?<\/Contents>/g)) distants.set(decodeXml(m[1]), Number(m[2]));
    jeton = /<IsTruncated>true<\/IsTruncated>/.test(xml) ? decodeXml(xml.match(/<NextContinuationToken>([^<]+)<\/NextContinuationToken>/)?.[1] ?? '') : '';
  } while (jeton);

  const locaux = fichiersLocaux(path.resolve('media'));
  const { aEnvoyer, conflits } = planifier(locaux, distants);
  console.log(`${locaux.length} images locales, ${distants.size} dans le bucket, ${aEnvoyer.length} à envoyer.`);
  if (conflits.length) {
    console.error(`${conflits.length} clés existent déjà avec une autre taille (ex. ${conflits.slice(0, 3).join(', ')}). Rien n'est envoyé : vérifie que deux villes n'ont pas le même nom d'image.`);
    process.exit(1);
  }
  if (essai || !aEnvoyer.length) return;

  let n = 0;
  const file = [...aEnvoyer];
  const worker = async () => {
    for (let f = file.shift(); f; f = file.shift()) {
      const res = await s3.fetch(`${base}/${f.cle.split('/').map(encodeURIComponent).join('/')}`, {
        method: 'PUT',
        body: fs.readFileSync(f.chemin),
        headers: { 'content-type': 'image/webp', 'cache-control': 'public, max-age=31536000, immutable' },
      });
      if (!res.ok) throw new Error(`Envoi refusé pour ${f.cle} : ${res.status}`);
      if (++n % 500 === 0) console.log(`${n}/${aEnvoyer.length}`);
    }
  };
  await Promise.all(Array.from({ length: 8 }, worker));
  console.log(`Images envoyées : ${n}.`);
}

const decodeXml = (s) => s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'");

/** Lit .env.local (KEY=VALUE) sans dépendance. */
function lireEnvLocal() {
  if (!fs.existsSync('.env.local')) return {};
  return Object.fromEntries(
    fs
      .readFileSync('.env.local', 'utf8')
      .split(/\r?\n/)
      .map((l) => l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/))
      .filter(Boolean)
      .map((m) => [m[1], m[2].replace(/^['"]|['"]$/g, '')]),
  );
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main().catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
}
