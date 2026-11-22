// Bon de commande pour le resto : la Function prépare les données et un identifiant signé ; le navigateur
// du client dessine l'image (lib/bon-canvas.ts) et l'envoie (POST /api/bon/<id>) ; le livreur l'ouvre
// depuis le lien du message WhatsApp (GET /bon/<id>). Aucune donnée client sur le bon.
// Pur (Web Crypto) : tourne dans la Function et dans les tests.
import { formaterPrix, type CommandeCalculee } from './commande';
import type { Livreur } from './livreur';
import { imageUrl } from './media';

/** Référence courte affichée sur le bon et dans le message (6 caractères). */
export function refCommande(d: Date = new Date()): string {
  const base = (d.getTime() % 36 ** 4).toString(36).toUpperCase().padStart(4, '0');
  const alea = Math.floor(Math.random() * 36 ** 2).toString(36).toUpperCase().padStart(2, '0');
  return base + alea;
}

const fmtDate = new Intl.DateTimeFormat('fr-FR', {
  timeZone: 'Africa/Tunis',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

export type DonneesBon = ReturnType<typeof donneesBon>;

/** Ce qui va sur le bon. Sans données client, et aux prix DU RESTO (jamais la majoration du livreur). */
export function donneesBon(c: CommandeCalculee, livreur: Livreur, ref: string, date: Date, base: string) {
  return {
    ref,
    livreur: livreur.nom,
    couleur: livreur.couleur,
    resto: c.resto.nom,
    date: fmtDate.format(date).replace(',', ''),
    lignes: c.lignes.map((l) => ({
      qte: l.qte,
      nom: l.plat.nom,
      options: l.options,
      prix: formaterPrix(l.sousTotalResto),
      image: imageUrl('product', l.plat.image, 'thumb', base),
    })),
    nbArticles: c.lignes.reduce((n, l) => n + l.qte, 0),
    sousTotal: formaterPrix(c.sousTotalResto),
    // Ce qui est retiré de ce que reçoit le resto (commission du livreur, part de promo payée par le resto), puis le net.
    deductions: [
      ...(c.commission ? [{ libelle: 'Commission du livreur', montant: `−${formaterPrix(c.commission)}` }] : []),
      ...(c.promo?.partResto ? [{ libelle: 'Promo payée par le resto', montant: `−${formaterPrix(c.promo.partResto)}` }] : []),
    ],
    aPayer: formaterPrix(c.dueResto),
  };
}

/** `REF-<32 hex>` : le jeton aléatoire rend l'URL du bon impossible à deviner. */
export const ID_BON = /^[A-Z0-9]{6}-[a-f0-9]{32}$/;

export function nouvelIdBon(ref: string): string {
  const jeton = [...crypto.getRandomValues(new Uint8Array(16))].map((b) => b.toString(16).padStart(2, '0')).join('');
  return `${ref}-${jeton}`;
}

/** Signature HMAC-SHA256 (hex) de l'identifiant : seul un bon préparé par /api/commande peut être envoyé. */
export async function signerBon(id: string, secret: string): Promise<string> {
  const cle = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', cle, new TextEncoder().encode(id));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function signatureValide(id: string, sig: string, secret: string): Promise<boolean> {
  if (!ID_BON.test(id) || !/^[a-f0-9]{64}$/.test(sig)) return false;
  const attendu = await signerBon(id, secret);
  let diff = 0;
  for (let i = 0; i < attendu.length; i++) diff |= attendu.charCodeAt(i) ^ sig.charCodeAt(i);
  return diff === 0;
}

/** Taille max d'un bon envoyé par le navigateur (un bon de 30 lignes en PNG fait ~300 Ko). */
export const TAILLE_MAX_BON = 1_500_000;
const SIGNATURE_PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
export const estPng = (b: Uint8Array) => b.length > 8 && SIGNATURE_PNG.every((x, i) => b[i] === x);
