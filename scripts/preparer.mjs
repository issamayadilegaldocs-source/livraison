// Choisit le client (livreur) du build et copie sa config dans .build/livreur.json.
// Lancé par `npm run dev` et `npm run build`. Client = variable CLIENT (dossier dans clients/),
// sinon le seul dossier présent. Le site (au build) et la Function lisent ensuite .build/livreur.json.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** @param {Record<string, string | undefined>} env */
export function choisirClient(env = process.env, racine = '.') {
  const dossier = path.join(racine, 'clients');
  const clients = fs.existsSync(dossier) ? fs.readdirSync(dossier).filter((d) => fs.existsSync(path.join(dossier, d, 'livreur.json'))) : [];
  // Sur Vercel, CLIENT n'est pas toujours posé : on le déduit du nom du projet / de l'URL de prod s'il ne désigne qu'un client.
  const indice = [env.VERCEL_PROJECT_NAME, env.VERCEL_PROJECT_PRODUCTION_URL].filter(Boolean).join(' ').toLowerCase();
  const parNom = clients.filter((c) => indice.includes(c.toLowerCase()));
  const client = env.CLIENT || (parNom.length === 1 ? parNom[0] : null) || (clients.length === 1 ? clients[0] : null);
  if (!client) throw new Error(`Précise le client : CLIENT=<dossier> parmi clients/ (${clients.join(', ') || 'aucun'}).`);
  if (!clients.includes(client)) throw new Error(`Client inconnu : clients/${client}/livreur.json n'existe pas.`);
  return client;
}

/** @param {Record<string, string | undefined>} env */
export function preparer(env = process.env, racine = '.') {
  const client = choisirClient(env, racine);
  // La config en ligne (promos, règles…) est rangée par numéro WhatsApp : deux clients au même numéro la partageraient.
  const numero = (c) => JSON.parse(fs.readFileSync(path.join(racine, 'clients', c, 'livreur.json'), 'utf8')).whatsapp;
  const double = fs.readdirSync(path.join(racine, 'clients')).find((c) => c !== client && fs.existsSync(path.join(racine, 'clients', c, 'livreur.json')) && numero(c) && numero(c) === numero(client));
  if (double) throw new Error(`clients/${client} et clients/${double} ont le même whatsapp (${numero(client)}) : ils partageraient les mêmes promos et réglages.`);
  fs.mkdirSync(path.join(racine, '.build'), { recursive: true });
  fs.copyFileSync(path.join(racine, 'clients', client, 'livreur.json'), path.join(racine, '.build', 'livreur.json'));
  return client;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  try {
    console.log(`Client : ${preparer()} → .build/livreur.json`);
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}
