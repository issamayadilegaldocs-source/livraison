import { z } from 'zod';
// Logique des Pages Functions (functions/), sans fs ni API Node : testable avec vitest, exécutée par Cloudflare.
import { donneesBon, estPng, ID_BON, nouvelIdBon, refCommande, signatureValide, signerBon, TAILLE_MAX_BON } from './bon';
import type { Menu, RestoIndex } from './catalogue';
import { calculerCommande, CommandeInputSchema, messageCommande, messageWhatsApp } from './commande';
import { envoyerEmail } from './email';
import { htmlClientCommande, htmlColis, htmlCommande, texteClientCommande } from './email-html';
import { calculerColis, ColisSchema, messageColis } from './colis';
import type { Livreur } from './livreur';
import { CommissionSchema, PromoSchema, vueClient, type Commission } from './commission';
import { FRAIS_SERVICE_ZIGZAG, FraisServiceSchema } from './frais-service';
import { ColisConfSchema } from './colis';
import { AnnonceSchema, PourboiresSchema, SupplementSchema } from './regles-livreur';
import { LivraisonGratuiteSchema } from './livraison-gratuite';
import { ConfigSchema, CorrectionSchema, correctionsClient, dateTunis, FraisSchema, lireConfig, pauseEnCours, prixClients, reglages, ServiceSchema, type Config, type Majoration } from './config';
import { formaterPrix } from './commande';
import { messageArret, quand } from './service';
import { appelerTelegram, envoyerTelegram, messageTelegram } from './telegram';
import { envoyerWhatsApp } from './whatsapp';
import { cleVapidPublique, endpointValide, envoyerPush, htmlPush } from './push';
import { ficheColis, ficheRepas, htmlCommandes, ID_FICHE, vueCommandes, type Fiche, type Statut } from './historique';
import { stockage, type EnvStockage, type SeauR2 } from './supabase';

export type { SeauR2 };

/** Variables et liaisons du projet Pages (secrets : Settings → Variables, ou `wrangler pages secret put`). */
export type Env = EnvStockage & {
  RESEND_API_KEY?: string;
  /** Alternative simple à Resend (expéditeur validé par lien, sans DNS). Si présente, elle sert à tous les emails ; exige MAIL_FROM. */
  BREVO_API_KEY?: string;
  MAIL_FROM?: string;
  CALLMEBOT_APIKEY?: string;
  /** Bot Telegram qui alerte le livreur (avec `telegram.chatId` dans livreur.json). Sans lui, pas d'alerte Telegram. */
  TELEGRAM_BOT_TOKEN?: string;
  /** Clé HMAC des bons. Sans elle (ou sans stockage), pas de bon : la commande part quand même. */
  BON_SECRET?: string;
  /** Clé privée VAPID (JWK, `npm run vapid`) des alertes push du livreur. Sans elle, pas d'alerte push. */
  VAPID_JWK?: string;
  /** Clé du lien de config du livreur (/api/config?cle=…). Sans elle, la page de config n'existe pas. */
  CONFIG_CLE?: string;
};

/** Resto + menu d'un restaurant (fichier statique /commande-data/<slug>) et base des images du build. */
export type DonneesResto = { resto: RestoIndex; menu: Menu; media: string };

/** Restos déjà modifiés (n > 0) d'abord ; tri stable : les autres gardent leur ordre. */
export const modifiesDabord = <T extends { n: number }>(l: T[]): T[] => [...l].sort((a, b) => Number(b.n > 0) - Number(a.n > 0));

const erreur = (status: number, message: string) => Response.json({ erreur: message }, { status });
const SLUG = /^[a-z0-9-]{1,120}$/;

/**
 * Verrou de domaine des écritures (POST) : un front copié sur un autre domaine ne peut pas se servir de nos Functions
 * (faux commandes, quota d'emails). Le navigateur envoie toujours `Origin` sur un POST : il doit avoir le même hôte que
 * la requête. Sans `Origin` (outil, même origine) on regarde `Sec-Fetch-Site`. Un script qui falsifie `Origin` passe :
 * ce verrou arrête les sites copiés, pas les scrapers. Jamais sur les GET ouverts par lien (bon, config).
 */
export function autreOrigine(req: Request): boolean {
  const origine = req.headers.get('origin');
  // `Origin: null` = formulaire posté depuis une page en `referrer-policy: no-referrer` (page config) : on s'en remet à Sec-Fetch-Site.
  if (origine && origine !== 'null') {
    try {
      return new URL(origine).host !== new URL(req.url).host;
    } catch {
      return true;
    }
  }
  return req.headers.get('sec-fetch-site') === 'cross-site';
}
const refus = () => erreur(403, 'Origine non autorisée.');

/**
 * POST /api/commande : valide et recalcule la commande (jamais les prix du client), envoie l'email au livreur
 * (filet de sécurité automatique), et renvoie le texte WhatsApp que le client enverra depuis « Dernière étape ».
 */
export async function traiterCommande(
  req: Request,
  env: Env,
  livreur: Livreur,
  lire: (slug: string) => Promise<DonneesResto | null>,
): Promise<Response> {
  if (autreOrigine(req)) return refus();
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return erreur(400, 'Commande invalide.');
  }
  const parsed = CommandeInputSchema.safeParse(body);
  if (!parsed.success) return erreur(400, 'Merci de vérifier le panier et vos coordonnées.');
  if (!SLUG.test(parsed.data.restoSlug)) return erreur(404, 'Restaurant introuvable.');

  // Réglages du livreur (page de config) : pause, horaires, frais, prix des plats. Ils font foi, même si la
  // page du client a été ouverte avant un changement.
  const config = await lireConfigR2(env, livreur);
  const { service, livraison, fraisService, livraisonGratuite, commission, promos, restosFermes, commandeMin, supplement } = reglages(livreur, config);
  const arret = messageArret(service, pauseEnCours(config, new Date()), new Date(), config.retour);
  if (arret) return erreur(400, arret);
  if (restosFermes.includes(parsed.data.restoSlug)) return erreur(400, 'Ce restaurant est indisponible pour le moment.');
  const codeSaisi = parsed.data.code?.trim().toUpperCase();
  const promoCode = codeSaisi ? promos.find((p) => p.code === codeSaisi) : undefined;
  if (promoCode?.limite && (await nbUsages(env, livreur, promoCode.code!, promoCode.limite)) >= promoCode.limite) return erreur(400, 'Ce code a atteint son nombre maximum d’utilisations.');

  const donnees = await lire(parsed.data.restoSlug);
  if (!donnees) return erreur(404, 'Restaurant introuvable.');
  // Prix client = prix du resto (ou nouveau prix saisi par le livreur) + majoration ; plats indisponibles retirés.
  const slug = donnees.resto.slug;
  const menu = { ...donnees.menu, plats: prixClients(donnees.menu.plats, livreur.majoration, slug, config.plats[slug]) };

  const commande = calculerCommande({ ...livreur, livraison, fraisService: fraisService ?? undefined, livraisonGratuite: livraisonGratuite ?? undefined, commission, promos }, donnees.resto, menu, parsed.data, new Date(), { commandeMin, supplement });
  if ('erreur' in commande) return erreur(400, commande.erreur);

  const origine = new URL(req.url).origin;
  // Images de l'email : Gmail ne charge pas « /media/... », il faut une URL absolue.
  const media = donnees.media.startsWith('/') ? origine + donnees.media : donnees.media;
  const ref = refCommande();
  const maintenant = new Date();

  // Bon : identifiant signé ; le navigateur du client dessine l'image et l'envoie ensuite.
  const store = stockage(env);
  const idBon = env.BON_SECRET && store ? nouvelIdBon(ref) : null;
  const lienBon = idBon ? `${origine}/api/bon/${idBon}` : null;
  const bon = idBon ? { id: idBon, sig: await signerBon(idBon, env.BON_SECRET!), donnees: donneesBon(commande, livreur, ref, maintenant, media) } : null;

  const texte = [`N° ${ref}`, messageCommande(commande, livreur), ...(lienBon ? ['', `Bon pour le resto : ${lienBon}`] : [])].join('\n');
  const texteWhatsApp = messageWhatsApp(commande, livreur, ref, lienBon);
  const html = htmlCommande(commande, livreur, ref, media, lienBon);
  await enregistrerFiche(env, livreur, ficheRepas(commande, ref, maintenant, html));

  const [email, whatsappAuto] = await Promise.all([
    envoyerEmail(
      livreur.email,
      `Commande N° ${ref} — ${donnees.resto.nom} — ${commande.client.nom}`,
      texte,
      env,
      html,
    ),
    // Envoi automatique seulement si une clé CallMeBot est configurée (sinon : 'skipped').
    envoyerWhatsApp(livreur.whatsapp, texteWhatsApp, env),
    // Alerte gratuite et sonore : message Telegram, et appel vocal si le livreur l'a demandé.
    livreur.telegram ? envoyerTelegram(livreur.telegram.chatId, messageTelegram(commande, ref), commande, env) : null,
    livreur.telegram?.appel && env.TELEGRAM_BOT_TOKEN ? appelerTelegram(livreur.telegram.appel, ref) : null,
    alerterPush(req, env, livreur),
    // Récapitulatif + montant à payer pour le client, seulement s'il a donné son email (facultatif).
    commande.client.email
      ? envoyerEmail(commande.client.email, `Votre commande N° ${ref} — ${donnees.resto.nom}`, texteClientCommande(commande, livreur, ref), env, htmlClientCommande(commande, livreur, ref))
      : null,
  ]);
  // WhatsApp (envoyé par le client) reste le canal principal : un échec d'email ne bloque pas la commande.
  if (email !== 'sent') console.error('[commande] email non envoyé', { ref, email });

  // Le code compte comme utilisé dès que la commande est partie.
  if (promoCode && commande.promo?.code === promoCode.code) await store?.enregistrerUsageCoupon(livreur.whatsapp, promoCode.code!, ref).catch(() => {});
  return Response.json({ ref, total: commande.total, texteWhatsApp, numeroWhatsApp: livreur.whatsapp, email, whatsappAuto, bon });
}

/** POST /api/bon/<id>?sig=… : enregistre l'image du bon dessinée par le navigateur (une seule fois par id). */
export async function recevoirBon(req: Request, env: Env, id: string): Promise<Response> {
  if (autreOrigine(req)) return refus();
  const store = stockage(env);
  if (!env.BON_SECRET || !store) return erreur(503, 'Bons désactivés.');
  const sig = new URL(req.url).searchParams.get('sig') ?? '';
  if (!(await signatureValide(id, sig, env.BON_SECRET))) return erreur(403, 'Bon non autorisé.');
  if (Number(req.headers.get('content-length') ?? 0) > TAILLE_MAX_BON) return erreur(413, 'Image trop lourde.');
  const png = new Uint8Array(await req.arrayBuffer());
  if (png.length > TAILLE_MAX_BON) return erreur(413, 'Image trop lourde.');
  if (!estPng(png)) return erreur(400, 'Image invalide.');
  // Premier envoi seulement : un id signé ne peut pas servir à remplacer un bon déjà enregistré.
  await store.enregistrerBon(id, png);
  return Response.json({ ok: true });
}

/** GET /api/bon/<id> : image du bon (lien du message WhatsApp). Expire avec la règle de cycle de vie du stockage. */
export async function servirBon(env: Env, id: string): Promise<Response> {
  const store = stockage(env);
  const body = ID_BON.test(id) && store ? await store.lireBon(id) : null;
  if (!body) return new Response('Bon introuvable ou expiré.', { status: 404, headers: { 'content-type': 'text/plain; charset=utf-8' } });
  return new Response(body, {
    headers: { 'content-type': 'image/png', 'cache-control': 'private, max-age=604800', 'x-robots-tag': 'noindex' },
  });
}

// --- Config du livreur (pause, horaires, frais, prix des plats) -----------------------------------
// Stocké dans Supabase (`livreur_configs`) ou R2 (`config/<whatsapp>.json`), indexé par numéro WhatsApp.
export async function lireConfigR2(env: Env, livreur: Livreur): Promise<Config> {
  const store = stockage(env);
  return store ? store.lireConfig(livreur.whatsapp) : lireConfig(null);
}

async function ecrireConfig(env: Env, livreur: Livreur, c: Config): Promise<void> {
  await stockage(env)!.ecrireConfig(livreur.whatsapp, c);
}

async function nbUsages(env: Env, livreur: Livreur, code: string, plafond: number): Promise<number> {
  const store = stockage(env);
  return store ? store.nbUsagesCoupon(livreur.whatsapp, code, plafond) : 0;
}

/** POST /api/coupon {code, resto} : le code existe-t-il, et que donne-t-il ? (vue client : jamais qui paie.) */
export async function verifierCoupon(req: Request, env: Env, livreur: Livreur): Promise<Response> {
  if (autreOrigine(req)) return refus();
  let body: { code?: unknown; resto?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return erreur(400, 'Code invalide.');
  }
  const code = typeof body.code === 'string' ? body.code.trim().toUpperCase() : '';
  const resto = typeof body.resto === 'string' ? body.resto : '';
  if (!/^[A-Z0-9]{3,20}$/.test(code) || !SLUG.test(resto)) return erreur(404, 'Ce code n’existe pas.');
  const { promos } = reglages(livreur, await lireConfigR2(env, livreur));
  const p = promos.find((x) => x.code === code && (!x.resto || x.resto === resto));
  if (p?.limite && (await nbUsages(env, livreur, code, p.limite)) >= p.limite) return erreur(404, 'Ce code a atteint son nombre maximum d’utilisations.');
  return p ? Response.json({ promo: vueClient(p) }, { headers: { 'cache-control': 'no-store' } }) : erreur(404, 'Ce code n’existe pas ou ne marche pas dans ce restaurant.');
}

/**
 * GET /api/etat[?resto=<slug>] : réglages en vigueur pour l'affichage (pause, horaires, frais, et corrections
 * de prix du resto demandé). Lu par les pages, mis en cache 2 min dans le navigateur.
 */
export async function etatLivreur(req: Request, env: Env, livreur: Livreur): Promise<Response> {
  const config = await lireConfigR2(env, livreur);
  const { service, livraison, fraisService, livraisonGratuite, colis, commission, promos, restosFermes, commandeMin, supplement, annonce, pourboires } = reglages(livreur, config);
  const resto = new URL(req.url).searchParams.get('resto') ?? '';
  // Corrections = prix client : le navigateur ne voit ni les prix du resto ni la majoration.
  const plats = SLUG.test(resto) ? correctionsClient(livreur.majoration, resto, config.plats[resto]) : {};
  const pause = pauseEnCours(config, new Date());
  return Response.json({ pause, retour: pause ? (config.retour ?? null) : null, service: service ?? null, livraison, fraisService, livraisonGratuite, colis, restosFermes, commandeMin, supplement, annonce, pourboires, promos: promos.filter((p) => !p.code).map(vueClient), plats }, { headers: { 'cache-control': 'no-store' } });
}

// --- Historique des commandes (Supabase `commandes` ou bucket R2 `BONS`) ------------------------------------
/** Ne bloque jamais la commande : l'email et le WhatsApp restent les canaux principaux. */
async function enregistrerFiche(env: Env, livreur: Livreur, f: Fiche): Promise<void> {
  try {
    await stockage(env)?.enregistrerFiche(livreur.whatsapp, f);
  } catch (e) {
    console.error('[historique]', e);
  }
}

// ponytail: 30 dernières fiches seulement (limite de sous-requêtes d'une Function du plan gratuit sur R2 : 50).
const MAX_FICHES = 30;

async function lireFiches(env: Env, livreur: Livreur): Promise<Fiche[]> {
  return stockage(env)!.lireFiches(livreur.whatsapp, MAX_FICHES);
}

/** /api/commandes?cle=… : GET = page des commandes (en cours / historique), POST {id, statut} = livrée, annulée ou remise en cours. */
export async function pageCommandes(req: Request, env: Env, livreur: Livreur): Promise<Response> {
  if (req.method === 'POST' && autreOrigine(req)) return refus();
  const url = new URL(req.url);
  const cle = url.searchParams.get('cle') ?? '';
  const store = stockage(env);
  if (!(await cleValide(cle, env.CONFIG_CLE)) || !store) return new Response('Page introuvable.', { status: 404, headers: { 'content-type': 'text/plain; charset=utf-8' } });

  if (req.method === 'POST') {
    let body: { id?: unknown; statut?: unknown };
    try {
      body = (await req.json()) as typeof body;
    } catch {
      return erreur(400, 'Demande invalide.');
    }
    if (typeof body.id !== 'string' || !ID_FICHE.test(body.id) || !['nouvelle', 'livree', 'annulee'].includes(body.statut as string)) return erreur(400, 'Demande invalide.');
    const ok = await store.majStatutFiche(livreur.whatsapp, body.id, body.statut as Statut, new Date());
    if (!ok) return erreur(404, 'Commande introuvable (peut-être effacée après 90 jours).');
    return Response.json({ ok: true });
  }
  return new Response(htmlCommandes({ nom: livreur.nom, couleur: livreur.couleur, cle, fiches: await lireFiches(env, livreur) }), {
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'x-robots-tag': 'noindex' },
  });
}

const MAX_APPAREILS = 5;

/** Alerte push aux téléphones du livreur. Ne bloque jamais la commande : toute erreur est seulement journalisée. */
async function alerterPush(req: Request, env: Env, livreur: Livreur): Promise<number> {
  const store = stockage(env);
  if (!env.VAPID_JWK || !store) return 0;
  try {
    const liste = await store.lireAbonnementsPush(livreur.whatsapp);
    if (!liste.length) return 0;
    const { envoyes, expires } = await envoyerPush(liste, env.VAPID_JWK, `https://${new URL(req.url).hostname}`);
    if (expires.length) await store.retirerAbonnementsPush(livreur.whatsapp, expires);
    return envoyes;
  } catch (e) {
    console.error('[push]', e);
    return 0;
  }
}

/**
 * /api/push?cle=… : GET = page d'activation des alertes (ou `&manifest=1` : manifeste pour l'écran d'accueil) ;
 * POST {endpoint} = enregistre ce téléphone, POST {test: true} = envoie une alerte test.
 */
export async function pagePush(req: Request, env: Env, livreur: Livreur): Promise<Response> {
  if (req.method === 'POST' && autreOrigine(req)) return refus();
  const url = new URL(req.url);
  const cle = url.searchParams.get('cle') ?? '';
  const store = stockage(env);
  if (!(await cleValide(cle, env.CONFIG_CLE)) || !store) return new Response('Page introuvable.', { status: 404, headers: { 'content-type': 'text/plain; charset=utf-8' } });

  if (req.method === 'POST') {
    let body: { endpoint?: unknown; test?: unknown };
    try {
      body = (await req.json()) as typeof body;
    } catch {
      return erreur(400, 'Demande invalide.');
    }
    if (body.test === true) return Response.json({ ok: true, envoyes: await alerterPush(req, env, livreur) });
    if (!endpointValide(body.endpoint)) return erreur(400, 'Téléphone non reconnu.');
    await store.ajouterAbonnementPush(livreur.whatsapp, body.endpoint, MAX_APPAREILS);
    return Response.json({ ok: true });
  }

  const page = `/api/push?cle=${encodeURIComponent(cle)}`;
  if (url.searchParams.get('manifest') === '1')
    return Response.json(
      { name: `${livreur.nom} — alertes commandes`, short_name: 'Alertes', start_url: page, scope: '/api/push', display: 'standalone', background_color: '#f6f7fb', theme_color: livreur.couleur, icons: [{ src: '/icone-alertes.png', sizes: '512x512', type: 'image/png' }] },
      { headers: { 'content-type': 'application/manifest+json' } },
    );
  return new Response(htmlPush({ nom: livreur.nom, couleur: livreur.couleur, cle, pub: env.VAPID_JWK ? cleVapidPublique(env.VAPID_JWK) : null }), {
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'x-robots-tag': 'noindex' },
  });
}

async function cleValide(donnee: string, attendue: string | undefined): Promise<boolean> {
  if (!attendue || !donnee) return false;
  // Comparaison à temps constant via des empreintes de même longueur.
  const h = async (t: string) => new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(t)));
  const [a, b] = await Promise.all([h(donnee), h(attendue)]);
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

/** Champ pourcentage : vide = aucune valeur (undefined), invalide = NaN. */
const pctOuVide = (v: string | null): number | undefined => {
  if (v === null || v.trim() === '') return undefined;
  const n = arrondi(nombre(v));
  return Number.isFinite(n) && n >= 0 && n <= 100 ? n : NaN;
};

/** Pose (ou retire, si `pct` est undefined) la commission d'un resto. */
function avecCommission(c: Commission | undefined, resto: string, pct: number | undefined): Commission {
  const restos = { ...CommissionSchema.parse(c ?? {}).restos };
  if (pct === undefined) delete restos[resto];
  else restos[resto] = pct;
  return { restos };
}

/** Où revenir après un enregistrement. */
const ANCRE_APRES: Record<string, string> = { prix1: '#simple', plats: '#prix', 'plats-reset': '#prix', 'commission-resto': '#commission','coupon-ajouter': '#coupons', horaires: '#horaires', frais: '#frais', colis: '#colis', minimum: '#minimum', annonce: '#annonce', pourboires: '#pourboires', supplement: '#supplement', 'resto-ferme': '#prix', 'livraison-gratuite': '#livraison-gratuite', 'frais-service': '#frais-service', reglages: '#reglages' };

/** Icônes (traits) à la place des emojis, comme sur la maquette. Clé = l'emoji sans le sélecteur de variante. */
const ICONES: Record<string, string> = {
  '⏰': '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  '🛵': '<rect x="1" y="6" width="14" height="10" rx="2"/><path d="M15 9h4l3 3v4h-7"/><circle cx="6" cy="18" r="2"/><circle cx="18" cy="18" r="2"/>',
  '🎁': '<rect x="3" y="8" width="18" height="13" rx="2"/><path d="M12 8v13M3 12h18M12 8c-2 0-4-1-4-3s3-2 4 0c1-2 4-2 4 0s-2 3-4 3z"/>',
  '💰': '<circle cx="12" cy="12" r="9"/><path d="M12 7v10M9.5 9.5h4a1.5 1.5 0 0 1 0 3h-3a1.5 1.5 0 0 0 0 3h4"/>',
  '💶': '<circle cx="12" cy="12" r="9"/><path d="M12 7v10M9.5 9.5h4a1.5 1.5 0 0 1 0 3h-3a1.5 1.5 0 0 0 0 3h4"/>',
  '📊': '<path d="M19 5 5 19"/><circle cx="6.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/>',
  '🏷': '<path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z"/><circle cx="7.5" cy="7.5" r="1"/>',
  '🎟': '<path d="M3 9a2 2 0 0 0 0 6v3h18v-3a2 2 0 0 1 0-6V6H3z"/><path d="M14 6v12" stroke-dasharray="2 3"/>',
  '📦': '<path d="M21 8 12 3 3 8v8l9 5 9-5z"/><path d="M3 8l9 5 9-5M12 13v8"/>',
  '🌧': '<path d="M7 18a4 4 0 0 1-.5-7.97A5.5 5.5 0 0 1 17 8.5a3.5 3.5 0 0 1 .5 6.96"/><path d="M8 21v-2M12 21v-3M16 21v-2"/>',
  '🧮': '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 7h8M8 12h2M12 12h2M8 16h2M12 16h2"/>',
  '🙏': '<path d="M12 21s-7-4.5-9-9a5 5 0 0 1 9-3 5 5 0 0 1 9 3c-2 4.5-9 9-9 9z"/>',
  '📢': '<path d="M3 11v2a1 1 0 0 0 1 1h3l5 4V6L7 10H4a1 1 0 0 0-1 1z"/><path d="M16 9a4 4 0 0 1 0 6"/>',
  '🍽': '<path d="M7 3v8M4 3v5a3 3 0 0 0 6 0V3M7 11v10M17 3c-2 2-3 5-3 8h3v10"/>',
  '✏': '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  '🍔': '<path d="M4 11h16a8 8 0 0 0-16 0z"/><path d="M3 15h18M5 15l1 4h12l1-4"/>',
};
const svgTrait = (d: string, taille: number) => `<svg width="${taille}" height="${taille}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const AMPOULE = '<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.5 1 2.5h6c0-1 .3-1.8 1-2.5A6 6 0 0 0 12 3z"/>';

/** Dernière main sur le HTML : emojis des en-têtes en icônes, et boîtes « À quoi ça sert ? » repliables. */
function habiller(html: string): string {
  return html
    .replace(/<span class="em"([^>]*)>([^<]+)<\/span>/g, (m, attrs: string, e: string) => {
      const d = ICONES[e.replace(/\uFE0F/g, '')];
      return d ? `<span class="em"${attrs}>${svgTrait(d, 30)}</span>` : m;
    })
    .replace(/(<a class="retour"[^>]*>)← /g, `$1${svgTrait('<path d="m15 6-6 6 6 6"/>', 20)}`)
    .replace(/<div class="astuce"><b>(?:💡 )?([^<]*)<\/b>([\s\S]*?)<\/div>/g, (_m, titre: string, corps: string) =>
      `<details class="astuce" open><summary><span style="color:#b58900">${svgTrait(AMPOULE, 22)}</span><span>${titre}</span><span class="chev" aria-hidden="true">${svgTrait('<path d="m6 15 6-6 6 6"/>', 18)}</span></summary><div class="ast">${corps}</div></details>`,
    );
}

/** Écrans de la page de config (`data-vue`) : l'ancre de l'URL choisit celui qu'on voit. */
const ECRANS_REGLAGE = ['horaires', 'frais', 'colis', 'supplement', 'minimum', 'pourboires', 'annonce', 'livraison-gratuite', 'frais-service', 'commission', 'promos', 'coupons'];
const VUES = ['commandes', 'accueil', 'prix', 'simple', 'reglages', 'horaires', 'frais', 'colis', 'supplement', 'minimum', 'pourboires', 'annonce', 'livraison-gratuite', 'frais-service', 'commission', 'promos', 'coupons'];

const nombre = (v: string | null) => (v === null || v.trim() === '' ? NaN : Number(v.replace(',', '.')));
const arrondi = (n: number) => Math.round(n * 1000) / 1000;

const avec = (f: URLSearchParams, action: string) => {
  const g = new URLSearchParams(f);
  g.set('action', action);
  return g;
};

/** Applique un formulaire de la page de config. Renvoie la nouvelle config, ou un message d'erreur. */
export function appliquerFormulaire(c: Config, form: URLSearchParams, menu: DonneesResto | null, maj?: Majoration): Config | string {
  // Prix que le client paie sans correction (prix du resto + majoration).
  // `sur` : nouveau prix du resto en cours de saisie (sinon celui déjà enregistré pour ce plat).
  const defaut = (p: DonneesResto['menu']['plats'][number], sur?: { resto?: number }) => {
    const r = sur ? sur.resto : c.plats[menu!.resto.slug]?.[p.id]?.resto;
    return prixClients([p], maj, menu!.resto.slug, r !== undefined ? { [p.id]: { resto: r } } : undefined)[0].prix;
  };
  const action = form.get('action');
  if (action === 'pause') {
    const retour = form.get('retour') ?? '';
    if (!retour) return { ...c, pause: true, retour: undefined };
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(retour) || Number.isNaN(dateTunis(retour).getTime())) return 'Heure de retour invalide.';
    if (dateTunis(retour) <= new Date()) return 'L’heure de retour doit être dans le futur.';
    return { ...c, pause: true, retour };
  }
  if (action === 'reprendre') return { ...c, pause: false, retour: undefined };
  if (action === 'reglages') {
    // Horaires + frais enregistrés d'un coup (un seul bouton sur la page).
    const h = appliquerFormulaire(c, avec(form, 'horaires'), menu, maj);
    if (typeof h === 'string') return h;
    const f = appliquerFormulaire(h, avec(form, 'frais'), menu, maj);
    return typeof f === 'string' ? f : appliquerFormulaire(f, avec(form, 'frais-service'), menu, maj);
  }
  if (action === 'frais-service') {
    // « Mettre par défaut » = formule Zigzag ; « Pas de frais de service » = case décochée.
    if (form.get('defaut') === '1') return { ...c, fraisService: FRAIS_SERVICE_ZIGZAG };
    if (form.get('fs_actif') !== 'on') return { ...c, fraisService: null };
    const r = FraisServiceSchema.safeParse({ pourcent: arrondi(nombre(form.get('fs_pourcent'))), min: arrondi(nombre(form.get('fs_min'))), max: arrondi(nombre(form.get('fs_max'))) });
    return r.success ? { ...c, fraisService: r.data } : 'Frais de service invalides : pourcentage entre 0 et 100, minimum ≤ maximum.';
  }
  if (action === 'livraison-gratuite') {
    // Gros bouton : « Mettre la livraison gratuite » (fg = on, avec un panier minimum facultatif) ou « Arrêter » (fg = off).
    if (form.get('fg') === 'off') return { ...c, livraisonGratuite: null };
    const min = nombre(form.get('fg_min'));
    const r = LivraisonGratuiteSchema.safeParse(Number.isFinite(min) && min > 0 ? { min: arrondi(min) } : {});
    return r.success ? { ...c, livraisonGratuite: r.data } : 'Panier minimum invalide : un nombre en dinars, par exemple 30.';
  }
  if (action === 'resto-ferme') {
    // Gros bouton sur la page du resto : fermer (f = 1) ou rouvrir (f = 0) ce resto.
    if (!menu) return 'Restaurant introuvable.';
    const slug = menu.resto.slug;
    const autres = c.restosFermes.filter((s) => s !== slug);
    return { ...c, restosFermes: form.get('f') === '1' ? [...autres, slug] : autres };
  }
  if (action === 'supplement-manuel') {
    // Interrupteur de l'accueil : allume ou éteint le supplément « pluie » déjà réglé (nom et montant gardés).
    const m = c.supplement?.manuel;
    if (!m) return 'Réglez d’abord le supplément (nom et montant).';
    return { ...c, supplement: { ...c.supplement, manuel: { ...m, actif: form.get('v') === 'on' } } };
  }
  if (action === 'minimum') {
    if (form.get('mn') === 'off') return { ...c, commandeMin: undefined };
    const v = arrondi(nombre(form.get('mn_val')));
    return v > 0 && v <= 1000 ? { ...c, commandeMin: v } : 'Commande minimum invalide : un montant en dinars, par exemple 10.';
  }
  if (action === 'annonce') {
    const t = (form.get('texte') ?? '').trim();
    if (form.get('an') === 'off' || !t) return { ...c, annonce: undefined };
    const r = AnnonceSchema.safeParse(t);
    return r.success ? { ...c, annonce: r.data } : 'Message trop long : 140 caractères au maximum.';
  }
  if (action === 'pourboires') {
    const l = [1, 2, 3, 4, 5, 6].map((i) => form.get(`pb${i}`)).filter((v) => v !== null && v.trim() !== '').map((v) => arrondi(nombre(v)));
    if (form.get('reset') === '1') return { ...c, pourboires: undefined };
    const r = PourboiresSchema.safeParse([...new Set(l)].sort((a, b) => a - b));
    return r.success ? { ...c, pourboires: r.data } : 'Montants invalides : de 1 à 6 montants entre 0,5 et 50 dinars.';
  }
  if (action === 'supplement') {
    const manuel = { actif: form.get('sm_actif') === 'on', montant: arrondi(nombre(form.get('sm_montant'))), libelle: (form.get('sm_libelle') ?? '').trim() || 'Pluie' };
    const nuit = { actif: form.get('sn_actif') === 'on', de: form.get('sn_de') ?? '', a: form.get('sn_a') ?? '', montant: arrondi(nombre(form.get('sn_montant'))) };
    // Un bloc éteint peut rester vide : on ne garde que ce qui est valide.
    const r = SupplementSchema.safeParse({ ...(manuel.montant > 0 && { manuel }), ...(nuit.montant > 0 && nuit.de && nuit.a && { nuit }) });
    if (!r.success) return 'Supplément invalide : un montant entre 0,1 et 50 dinars, et pour la nuit une heure de début et de fin.';
    return { ...c, supplement: r.data };
  }
  if (action === 'colis') {
    if (form.get('reset') === '1') return { ...c, colis: undefined };
    const champs = ['base', 'parKm', 'min', 'max', 'rayonMaxKm', 'c_moyen', 'c_grand'].map((k) => arrondi(nombre(form.get(k))));
    const [base, parKm, min, max, rayonMaxKm, moyen, grand] = champs;
    const urgent = arrondi(nombre(form.get('c_urgent'))) || 0;
    const nuit = { actif: form.get('c_nuit_actif') === 'on', de: form.get('c_nuit_de') ?? '', a: form.get('c_nuit_a') ?? '', montant: arrondi(nombre(form.get('c_nuit_mt'))) };
    const r = ColisConfSchema.safeParse({ actif: form.get('c_actif') === 'on', base, parKm, min, max, rayonMaxKm, moyen, grand, urgent, ...(nuit.montant > 0 && nuit.de && nuit.a && { nuit }) });
    return r.success ? { ...c, colis: r.data } : 'Tarif colis invalide : vérifiez les montants (minimum ≤ maximum, distance ≤ 60 km, suppléments entre 0 et 100).';
  }
  if (action === 'horaires') {
    if (form.get('auto') !== 'on') return { ...c, service: null };
    const r = ServiceSchema.safeParse({ ouvre: form.get('ouvre'), ferme: form.get('ferme') });
    return r.success ? { ...c, service: r.data } : 'Horaires invalides : heure d’ouverture et de fermeture différentes, au format HH:MM.';
  }
  if (action === 'frais') {
    const r = FraisSchema.safeParse(Object.fromEntries(['base', 'parKm', 'min', 'max', 'rayonMaxKm'].map((k) => [k, arrondi(nombre(form.get(k)))])));
    return r.success ? { ...c, frais: r.data } : 'Frais invalides : vérifiez les montants (minimum ≤ maximum, rayon ≤ 60 km).';
  }
  if (action === 'prix1') {
    // Parcours simple : le prix du RESTO et le prix CLIENT d'UN plat (égal au prix normal = correction retirée).
    const p = menu?.menu.plats.find((x) => x.id === Number(form.get('plat')));
    if (!menu || !p) return 'Plat introuvable.';
    const prix = arrondi(nombre(form.get('prix')));
    if (!Number.isFinite(prix) || prix <= 0 || prix > 1000) return 'Prix invalide : tapez un nombre, par exemple 12,5.';
    const slug = menu.resto.slug;
    // Prix chez le resto : vide ou égal au menu = pas de correction ; sinon c'est le nouveau prix du resto.
    let restoNew: number | undefined = c.plats[slug]?.[p.id]?.resto;
    const rBrut = form.get('prix_resto');
    if (rBrut !== null) {
      const r = arrondi(nombre(rBrut));
      if (rBrut.trim() === '') restoNew = undefined;
      else if (!Number.isFinite(r) || r <= 0 || r > 1000) return 'Prix du resto invalide : tapez un nombre, par exemple 10,5.';
      else restoNew = r === p.prix ? undefined : r;
    }
    const { prix: _ancien, resto: _r, ...reste } = c.plats[slug]?.[p.id] ?? {};
    const corr = { ...reste, ...(restoNew !== undefined && { resto: restoNew }), ...(prix !== defaut(p, { resto: restoNew }) && { prix }) };
    const resto = { ...c.plats[slug] };
    if (Object.keys(corr).length) resto[p.id] = corr;
    else delete resto[p.id];
    const plats = { ...c.plats };
    if (Object.keys(resto).length) plats[slug] = resto;
    else delete plats[slug];
    return { ...c, plats };
  }
  // Commission : un seul pourcentage par resto (case vide = aucune). Jamais mélangée au prix des plats ni à la majoration.
  if (action === 'commission-resto') {
    if (!menu) return 'Restaurant introuvable.';
    const cr = pctOuVide(form.get('ct_resto'));
    if (Number.isNaN(cr)) return 'Commission invalide : un pourcentage entre 0 et 100.';
    return { ...c, commission: avecCommission(c.commission, menu.resto.slug, cr) };
  }
  if (action === 'promo-ajouter' || action === 'coupon-ajouter') {
    // Une promotion est automatique ; un coupon a un code que le client tape. Deux créations séparées : jamais mélangées.
    const coupon = action === 'coupon-ajouter';
    const code = coupon ? (form.get('code') ?? '').trim() : '';
    if (coupon && !code) return 'Un coupon a besoin d’un code : 3 à 20 lettres ou chiffres, sans espace (ex. BIENVENUE10).';
    const financeur = form.get('financeur');
    // Promo sur un seul plat : le plat doit exister dans le resto (la page du plat envoie les deux).
    const platId = Number(form.get('plat'));
    if (form.get('plat') && (!menu || !form.get('resto') || menu.resto.slug !== form.get('resto') || !menu.menu.plats.some((p) => p.id === platId))) return 'Plat introuvable.';
    const brut = {
      id: [...crypto.getRandomValues(new Uint8Array(6))].map((b) => (b % 36).toString(36)).join(''),
      // Un coupon n'a qu'un champ : son code, qui sert aussi de nom (le client voit « Coupon CODE »).
      nom: coupon ? code.toUpperCase() : (form.get('nom') ?? ''),
      type: form.get('type'),
      valeur: arrondi(nombre(form.get('valeur'))),
      ...(Number.isFinite(nombre(form.get('max'))) && { max: arrondi(nombre(form.get('max'))) }),
      ...(Number.isFinite(nombre(form.get('min'))) && { min: arrondi(nombre(form.get('min'))) }),
      ...(form.get('resto') && { resto: form.get('resto')! }),
      ...(form.get('plat') && { plat: platId }),
      ...(code && { code }),
      ...(code && form.get('cumulable') === 'on' && { cumulable: true }),
      ...(code && Number.isFinite(nombre(form.get('limite'))) && nombre(form.get('limite')) >= 1 && { limite: Math.round(nombre(form.get('limite'))) }),
      financeur,
      ...(financeur === 'partage' && { partResto: Math.round(nombre(form.get('partResto'))) }),
      actif: true,
    };
    const r = PromoSchema.safeParse(brut);
    if (!r.success) return coupon ? 'Coupon invalide : un nom, un code de 3 à 20 lettres ou chiffres (sans espace), une valeur (pourcentage ≤ 100), et si vous partagez la remise, la part du resto entre 1 et 99.' : 'Promotion invalide : un nom, une valeur (pourcentage ≤ 100), et si vous partagez la remise, la part du resto entre 1 et 99.';
    if (r.data.code && (c.promos ?? []).some((p) => p.code === r.data.code)) return `Le code ${r.data.code} existe déjà : choisissez-en un autre.`;
    return { ...c, promos: [...(c.promos ?? []), r.data] };
  }
  if (action === 'promo-actif' || action === 'promo-suppr') {
    const id = form.get('id');
    const promos = c.promos ?? [];
    if (!promos.some((p) => p.id === id)) return 'Promo introuvable.';
    return { ...c, promos: action === 'promo-suppr' ? promos.filter((p) => p.id !== id) : promos.map((p) => (p.id === id ? { ...p, actif: !p.actif } : p)) };
  }
  if (action === 'plats' || action === 'plats-reset') {
    if (!menu) return 'Restaurant introuvable.';
    const slug = menu.resto.slug;
    const plats = { ...c.plats };
    if (action === 'plats-reset') {
      delete plats[slug];
      return { ...c, plats };
    }
    const corrections: Record<string, z.infer<typeof CorrectionSchema>> = {};
    for (const p of menu.menu.plats) {
      const prix = arrondi(nombre(form.get(`prix_${p.id}`)));
      const indispo = form.get(`indispo_${p.id}`) === 'on';
      if (Number.isFinite(prix) && (prix <= 0 || prix > 1000)) return `Prix invalide pour « ${p.nom} ».`;
      const rExistant = c.plats[slug]?.[p.id]?.resto;
      const corr = { ...(rExistant !== undefined && { resto: rExistant }), ...(Number.isFinite(prix) && prix !== defaut(p) && { prix }), ...(indispo && { indispo: true as const }) };
      if (Object.keys(corr).length) corrections[p.id] = corr;
    }
    if (Object.keys(corrections).length) plats[slug] = corrections;
    else delete plats[slug];
    return { ...c, plats };
  }
  return 'Action inconnue.';
}

/**
 * /api/config?cle=…[&resto=<slug>] : page du livreur (lien secret gardé en favori) pour la pause, les horaires,
 * les frais de livraison et les prix des plats. GET affiche ; POST (formulaire) enregistre puis réaffiche.
 */
export async function pageConfig(
  req: Request,
  env: Env,
  livreur: Livreur,
  lire: (slug: string) => Promise<DonneesResto | null>,
  lireRestos: () => Promise<{ slug: string; nom: string }[]>,
): Promise<Response> {
  if (req.method === 'POST' && autreOrigine(req)) return refus();
  const url = new URL(req.url);
  let cle = url.searchParams.get('cle') ?? '';
  let resto = url.searchParams.get('resto') ?? '';
  const plat = /^\d{1,9}$/.test(url.searchParams.get('plat') ?? '') ? Number(url.searchParams.get('plat')) : null;
  const form = req.method === 'POST' ? new URLSearchParams(await req.text()) : null;
  if (form) {
    cle = form.get('cle') ?? cle;
    resto = form.get('resto') ?? resto;
  }
  if (!(await cleValide(cle, env.CONFIG_CLE)) || !stockage(env)) return new Response('Page introuvable.', { status: 404, headers: { 'content-type': 'text/plain; charset=utf-8' } });
  if (resto && !SLUG.test(resto)) resto = '';

  const menu = resto ? await lire(resto) : null;
  let config = await lireConfigR2(env, livreur);
  let message = '';
  if (form) {
    // Commission et promos de livreur.json deviennent les siennes dès qu'il y touche (pas de perte au premier enregistrement).
    if (/^(commission|promo|coupon|prix1)/.test(form.get('action') ?? '')) config = { ...config, commission: config.commission ?? livreur.commission, promos: config.promos ?? livreur.promos };
    const r = appliquerFormulaire(config, form, menu, livreur.majoration);
    if (typeof r === 'string') message = `❌ ${r}`;
    else {
      await ecrireConfig(env, livreur, r);
      // Après un POST réussi : redirection pour qu'un rechargement ne renvoie pas le formulaire.
      const q = new URLSearchParams({ cle, ok: '1', ...(form.get('action') === 'prix1' && { simple: '1' }), ...(resto && { resto }) });
      // Commission enregistrée : retour à la liste des restos.
      if (form.get('action') === 'commission-resto') {
        q.set('ok', 'commission');
        q.delete('resto');
      }
      // Promo posée depuis la page d'un plat : on y revient (le livreur voit sa promo et peut l'arrêter).
      const depuisPlat = /^(promo|coupon)/.test(form.get('action') ?? '') && form.get('plat');
      if (depuisPlat) {
        q.set('simple', '1');
        q.set('plat', form.get('plat')!);
      }
      return new Response(null, { status: 303, headers: { location: `${url.pathname}?${q}${(form.get('vers') === 'accueil' ? '#accueil' : /^(promo|coupon)/.test(form.get('action') ?? '') && form.get('plat') ? '#simple' : ANCRE_APRES[form.get('action') ?? ''] ?? (form.get('retour') === 'coupons' ? '#coupons' : /^(promo|coupon)/.test(form.get('action') ?? '') ? '#promos' : ''))}`, 'cache-control': 'no-store' } });
    }
  } else if (url.searchParams.get('ok') === 'commission') message = '✅ Commission enregistrée. Elle apparaît à droite du resto dans la liste.';
  else if (url.searchParams.get('ok')) message = '✅ Enregistré. Les clients voient le changement d’ici 2 minutes.';

  const restos = await lireRestos();
  // Utilisations des coupons à limite (affichées dans la liste des promos).
  const usages: Record<string, number> = {};
  for (const p of config.promos ?? livreur.promos ?? []) if (p.code && p.limite) usages[p.code] = await nbUsages(env, livreur, p.code, p.limite);
  // Écran « Commandes » : les dernières fiches (R2 les rend de la plus récente à la plus ancienne).
  const fiches = await lireFiches(env, livreur).catch(() => []);
  const html = htmlConfig({ livreur, config, cle, message, restos, menu, plat, usages, fiches });
  return new Response(html, {
    status: message.startsWith('❌') ? 400 : 200,
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'x-robots-tag': 'noindex', 'referrer-policy': 'no-referrer' },
  });
}

const echapper = (t: string) => t.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const nb = (n: number) => String(arrondi(n));

function htmlConfig(o: { livreur: Livreur; config: Config; cle: string; message: string; restos: { slug: string; nom: string }[]; menu: DonneesResto | null; plat?: number | null; usages?: Record<string, number>; fiches?: Fiche[] }): string {
  const { livreur, config, cle, message, restos, menu, plat = null, usages = {}, fiches = [] } = o;
  const cmd = vueCommandes(fiches, livreur.couleur, cle);
  const nbEnCours = fiches.filter((f) => f.statut === 'nouvelle').length;
  const { service, livraison, fraisService, livraisonGratuite, commission, promos } = reglages(livreur, config);
  const couleur = livreur.couleur;
  const champCle = `<input type="hidden" name="cle" value="${echapper(cle)}">`;
  const maintenant = new Date();
  const pause = pauseEnCours(config, maintenant);
  // Proposition d'heure de retour : dans 1 h, à l'heure de Tunis (format datetime-local).
  const dansUneHeure = new Date(maintenant.getTime() + 3600e3 + 3600e3).toISOString().slice(0, 16);
  const corrections = menu ? (config.plats[menu.resto.slug] ?? {}) : {};
  const nbCorriges = Object.values(config.plats).reduce((n, r) => n + Object.keys(r).length, 0);
  const champ = (nom: string, label: string, valeur: number, pas = '0.1', unite = 'DT') =>
    `<label>${label}<span class="u"><input type="number" inputmode="decimal" step="${pas}" min="0" name="${nom}" value="${nb(valeur)}" required>${unite}</span></label>`;

  // Le livreur saisit le prix CLIENT ; le prix du resto reste celui du menu, la page affiche la majoration.
  const dt = (n: number) => `${n.toFixed(3).replace('.', ',')} DT`;
  const saisie = (n: number) => n.toFixed(3).replace('.', ',');
  // Prix du resto corrigé par le livreur (sinon celui du menu importé) et prix client par défaut qui en découle.
  const restoEff = (p: { id: number; prix: number }) => corrections[p.id]?.resto ?? p.prix;
  const corrResto = Object.fromEntries(Object.entries(corrections).filter(([, v]) => v.resto !== undefined).map(([id, v]) => [id, { resto: v.resto }]));
  const clients = menu ? new Map(prixClients(menu.menu.plats, livreur.majoration, menu.resto.slug, corrResto).map((p) => [p.id, p.prix])) : new Map<number, number>();
  const com = config.commission ?? livreur.commission; // commission en vigueur (config du livreur, sinon livreur.json)
  const lignesPlats = menu
    ? menu.menu.plats
        .map((p) => {
          const c = corrections[p.id] ?? {};
          const client = clients.get(p.id) ?? p.prix;
          const eff = c.prix ?? client;
          const pm = c.prix !== undefined && c.prix !== client;
          return `<div class="plat${pm || c.indispo ? ' mod' : ''}${pm ? ' pm' : ''}" data-nom="${echapper(p.nom.toLowerCase())}" data-init="${client}" data-resto="${restoEff(p)}">
<div class="l1"><span class="nm"><b>${echapper(p.nom)}</b><span class="tag">MODIFIÉ</span></span>
<label class="px"><input type="text" inputmode="decimal" name="prix_${p.id}" value="${saisie(eff)}" aria-label="Prix client pour ${echapper(p.nom)}"><span>DT</span></label></div>
<div class="l2"><span class="sub">🏪 Resto <b>${dt(restoEff(p))}</b>${corrections[p.id]?.resto !== undefined ? ' <i style="font-style:normal;color:#9a4a00">(corrigé)</i>' : ''} · 💰 Majoration <b class="cli">${dt(eff - restoEff(p))}</b></span>
<button type="button" class="lien" data-reset>Remettre</button></div>
<label class="ind"><input type="checkbox" name="indispo_${p.id}"${c.indispo ? ' checked' : ''}><span>🚫 Plat indisponible</span></label></div>`;
        })
        .join('')
    : '';
  // Récap par resto : prix modifiés et plats indisponibles.
  const compte = (slug: string) => {
    const l = Object.values(config.plats[slug] ?? {});
    return { prix: l.filter((x) => x.prix !== undefined).length, indispo: l.filter((x) => x.indispo).length };
  };
  const nbRestosCorriges = Object.keys(config.plats).length;
  const nbIndispo = Object.values(config.plats).reduce((n, r) => n + Object.values(r).filter((x) => x.indispo).length, 0);
  const regleTous = livreur.majoration?.tous;
  const textMaj = regleTous ? ('montant' in regleTous ? `+${dt(regleTous.montant)}` : `+${nb(regleTous.pourcent)} %`) : 'aucune';
  // Commission et promos en vigueur (réglages du livreur, sinon livreur.json).
  const promosEff = config.promos ?? livreur.promos ?? [];
  const nbPromos = promosEff.filter((p) => !p.code).length;
  const promosActives = promosEff.filter((p) => !p.code && p.actif).length;
  const nbCoupons = promosEff.filter((p) => p.code).length;
  const couponsActifs = promosEff.filter((p) => p.code && p.actif).length;
  const nomResto = (slug: string) => restos.find((r) => r.slug === slug)?.nom ?? slug;
  const nbCom = Object.keys(com?.restos ?? {}).length;
  const phrasePromo = (p: (typeof promosEff)[number]) => {
    const remise = p.type === 'pourcent' ? `${nb(p.valeur)} % de remise` : `${dt(p.valeur)} de remise`;
    const cond = [p.max ? `au maximum ${dt(p.max)}` : '', p.min ? `dès ${dt(p.min)} de plats` : '', p.plat ? `${menu?.menu.plats.find((x) => x.id === p.plat) ? `sur le plat « ${menu.menu.plats.find((x) => x.id === p.plat)!.nom} »` : 'sur un seul plat'} chez ${nomResto(p.resto ?? '')}` : p.resto ? `chez ${nomResto(p.resto)}` : 'dans tous les restos'].filter(Boolean).join(', ');
    const qui = p.financeur === 'livreur' ? 'Payée par vous.' : p.financeur === 'resto' ? 'Payée par le resto.' : `Payée ${100 - (p.partResto ?? 0)} % par vous et ${p.partResto} % par le resto.`;
    const extra = [p.cumulable ? 'Se cumule avec les promos automatiques.' : '', p.limite ? `Utilisé ${usages[p.code ?? ''] ?? 0} fois sur ${p.limite}.` : ''].filter(Boolean).join(' ');
    return `${p.code ? `Code « ${p.code} » : ` : ''}${remise}, ${cond}. ${qui}${extra ? ` ${extra}` : ''}`;
  };
  // Carte d'une promo ou d'un coupon (phrase claire + Arrêter / Supprimer). `ctx` : champs cachés de la page du plat.
  const carteP = (p: (typeof promosEff)[number], retour: 'promos' | 'coupons', ctx = '') => {
    const c = retour === 'coupons' ? '#a61e4d' : '#d6336c';
    return `<div class="promo${p.actif ? '' : ' off'}" style="--c:${p.actif ? c : '#9aa0b4'}"><b>${p.actif ? '🟢' : '⚪'} ${echapper(p.nom)}${p.actif ? '' : ' (arrêté)'}</b>
<span>${echapper(phrasePromo(p))}</span>
<div class="grille"><form method="post">${champCle}${ctx}<input type="hidden" name="retour" value="${retour}"><input type="hidden" name="action" value="promo-actif"><input type="hidden" name="id" value="${p.id}"><button class="sec">${p.actif ? '⏸ Arrêter' : '▶ Remettre'}</button></form><form method="post">${champCle}${ctx}<input type="hidden" name="retour" value="${retour}"><input type="hidden" name="action" value="promo-suppr"><input type="hidden" name="id" value="${p.id}"><button class="rouge">🗑 Supprimer</button></form></div></div>`;
  };
  const promosSeules = promosEff.filter((p) => !p.code);
  const couponsSeuls = promosEff.filter((p) => p.code);
  const promosListe = promosSeules.map((p) => carteP(p, 'promos')).join('');
  const couponsListe = couponsSeuls.map((p) => carteP(p, 'coupons')).join('');
  const rg = reglages(livreur, config);
  const colisConf = rg.colis;
  // Réglages groupés par sujet, comme la maquette : cartes « Gagner plus », tuiles « Attirer », listes « Livraison » / « Mon site ».
  const ligneReg = (href: string, c: string, t: string, titre: string, etat: string, actif: boolean) =>
    `<a href="${href}" style="--c:${c};--t:${t}"><span class="pt2" style="background:${c}"></span><span class="tt">${titre}</span><span class="chip${actif ? ' on' : ''}">${etat}</span><span class="ch" aria-hidden="true">›</span></a>`;
  const supplementActif = Boolean(rg.supplement?.manuel?.actif || rg.supplement?.nuit?.actif);
  const supplementEtat = supplementActif ? [rg.supplement?.manuel?.actif ? rg.supplement.manuel.libelle : '', rg.supplement?.nuit?.actif ? 'Nuit' : ''].filter(Boolean).map(echapper).join(' + ') : 'Aucun';
  const gratuiteEtat = livraisonGratuite ? (livraisonGratuite.min ? `Dès ${dt(livraisonGratuite.min)}` : 'Pour tous') : 'Non';
  const fraisServiceEtat = fraisService ? `${nb(fraisService.pourcent)} %` : 'Aucun';
  const groupesReglages = `<h2 class="groupe" style="color:#d9650b">Restos</h2>
<div class="liste-reg">
${ligneReg('#commission', '#d9650b', '#fdeedd', 'Commission par resto', nbCom ? `${nbCom} resto${nbCom > 1 ? 's' : ''}` : 'Aucune', Boolean(nbCom))}${ligneReg('#prix', '#2b8a3e', '#ebfbee', 'Plats, indisponible, fermer un resto', '', false)}
</div>
<h2 class="groupe" style="color:#12805c">Gagner plus</h2>
<div class="liste-reg">
${ligneReg('#frais-service', '#12805c', '#e3f5ed', 'Frais de service', fraisServiceEtat, Boolean(fraisService))}${ligneReg('#pourboires', '#ae3ec9', '#f8ebfc', 'Montants de pourboire', rg.pourboires.map((v) => nb(v)).join(' · '), false)}
</div>
<h2 class="groupe" style="color:#d6336c">Attirer les clients</h2>
<div class="liste-reg">
${ligneReg('#promos', '#d6336c', '#fde7ef', 'Promotions', nbPromos ? `${promosActives} active${promosActives > 1 ? 's' : ''}` : 'Aucune', promosActives > 0)}${ligneReg('#coupons', '#a61e4d', '#ffdeeb', 'Coupons', nbCoupons ? `${couponsActifs} actif${couponsActifs > 1 ? 's' : ''}` : 'Aucun', couponsActifs > 0)}
</div>
<h2 class="groupe" style="color:#1a6be0">Livraison</h2>
<div class="liste-reg">
${ligneReg('#frais', '#1a6be0', '#e6efff', 'Frais de livraison', `${dt(livraison.base)} + ${dt(livraison.parKm)} / km`, false)}${ligneReg('#livraison-gratuite', '#0f8f7e', '#dff5f1', 'Livraison gratuite', gratuiteEtat, Boolean(livraisonGratuite))}${ligneReg('#supplement', '#0c8599', '#e3fafc', 'Supplément pluie et nuit', supplementEtat, supplementActif)}${ligneReg('#colis', '#7048e8', '#efe9ff', 'Tarif des colis', !colisConf.actif ? 'Fermés' : config.colis ?? livreur.colis ? 'Tarif à part' : 'Comme les repas', false)}
</div>
<h2 class="groupe" style="color:#6d4aff">Mon site</h2>
<div class="liste-reg">
${ligneReg('#horaires', '#6d4aff', '#efeaff', 'Horaires', service ? `${service.ouvre} – ${service.ferme}` : 'Toujours ouvert', false)}${ligneReg('#minimum', '#364fc9', '#e7ecff', 'Commande minimum', rg.commandeMin ? dt(rg.commandeMin) : 'Aucun', Boolean(rg.commandeMin))}${ligneReg('#annonce', '#e67700', '#fff4e0', 'Message d’annonce', rg.annonce ? 'Affiché' : 'Aucun', Boolean(rg.annonce))}${ligneReg(`/api/push?cle=${encodeURIComponent(cle)}`, '#c92a2a', '#ffe3e3', 'Alertes de commande', '', false)}
</div>`;
  // Accueil : interrupteur direct quand c'est allumé (un toucher l'éteint) ; éteint, un toucher ouvre le réglage (jamais d'allumage par erreur).
  const interrupteur = (actif: boolean, c: string, label: string, ecran: string, formAction: string, champs: string) =>
    actif
      ? `<form method="post" style="margin:0">${champCle}<input type="hidden" name="action" value="${formAction}"><input type="hidden" name="vers" value="accueil">${champs}<button type="submit" role="switch" aria-checked="true" aria-label="${label}" class="sw on" style="--c:${c}"><i></i></button></form>`
      : `<a href="#${ecran}" role="switch" aria-checked="false" aria-label="${label} : régler" class="sw" style="--c:${c}"><i></i></a>`;
  const supplementManuel = rg.supplement?.manuel;
  const tuileIntr = (c: string, t: string, emoji: string, titre: string, etat: string, actif: boolean, intr: string) =>
    `<div class="tuile" style="--c:${c};--t:${t}"><div class="haut"><span class="em2"><span class="em" aria-hidden="true" style="display:contents">${emoji}</span></span>${intr}</div><b>${titre}</b><span class="${actif ? 'on' : ''}">${etat}</span></div>`;
  const raccourcis = `<div class="deux">
<a class="tuile" href="?cle=${encodeURIComponent(cle)}&simple=1#simple" style="--c:#2b8a3e;--t:#ebfbee"><div class="haut"><span class="em2"><span class="em" aria-hidden="true" style="display:contents">✏️</span></span></div><b>Changer le prix d’un plat</b><span>3 touches</span></a>
${tuileIntr('#0f8f7e', '#dff5f1', '🎁', 'Livraison gratuite', livraisonGratuite ? `Active ${livraisonGratuite.min ? `dès ${dt(livraisonGratuite.min).replace(',000', '')}` : 'pour tous'}` : 'Éteinte', Boolean(livraisonGratuite), interrupteur(Boolean(livraisonGratuite), '#0f8f7e', 'Livraison gratuite', 'livraison-gratuite', 'livraison-gratuite', '<input type="hidden" name="fg" value="off">'))}
${tuileIntr('#0c8599', '#e3fafc', '🌧️', 'Supplément pluie', supplementManuel?.actif ? `Allumé · +${dt(supplementManuel.montant).replace(',000', '')}` : `Éteint${supplementManuel ? ` · +${dt(supplementManuel.montant).replace(',000', '')}` : ''}`, Boolean(supplementManuel?.actif), supplementManuel ? (supplementManuel.actif ? interrupteur(true, '#0c8599', 'Supplément pluie', 'supplement', 'supplement-manuel', '<input type="hidden" name="v" value="off">') : `<form method="post" style="margin:0">${champCle}<input type="hidden" name="action" value="supplement-manuel"><input type="hidden" name="vers" value="accueil"><input type="hidden" name="v" value="on"><button type="submit" role="switch" aria-checked="false" aria-label="Supplément pluie" class="sw" style="--c:#0c8599"><i></i></button></form>`) : interrupteur(false, '#0c8599', 'Supplément pluie', 'supplement', '', ''))}
${tuileIntr('#e67700', '#fff4e0', '📢', 'Message d’annonce', rg.annonce ? 'Affiché en haut du site' : 'Aucun message', Boolean(rg.annonce), interrupteur(Boolean(rg.annonce), '#e67700', 'Message d’annonce', 'annonce', 'annonce', '<input type="hidden" name="an" value="off">'))}
</div>
`;
  const ico = (d: string) => `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
  const ligne = (href: string, icone: string, titre: string, sous: string, extra = '', fort = false) =>
    `<a class="ligne${fort ? ' fort' : ''}" href="${href}"><span class="pic">${ico(icone)}</span><span class="tx"><b>${titre}</b><span>${sous}</span>${extra}</span><span class="ch" aria-hidden="true">›</span></a>`;

  return habiller(`<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="robots" content="noindex"><link rel="apple-touch-icon" href="/icone-reglages.png"><link rel="icon" href="/icone-reglages.png"><meta name="apple-mobile-web-app-title" content="Réglages"><title>${echapper(livreur.nom)} — réglages</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;600;700;800&display=swap">
<style>
*{box-sizing:border-box}body{margin:0;font-family:'Plus Jakarta Sans',system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;background:#f6f7fb;color:#141a2b;
padding:max(56px,calc(env(safe-area-inset-top) + 24px)) max(16px,env(safe-area-inset-right)) calc(100px + env(safe-area-inset-bottom)) max(16px,env(safe-area-inset-left))}
main{max-width:560px;margin:0 auto;display:flex;flex-direction:column;gap:14px}h1{font-size:26px;margin:0;font-weight:800;letter-spacing:-.02em}h2{font-size:17px;margin:0;font-weight:800}p{margin:0;color:#5b6479;font-size:14px;line-height:1.45}
.sous{margin-top:4px}.tit{margin:6px 0 -4px;font-size:13px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#5b6479}
.carte{background:#fff;border-radius:22px;padding:18px;display:flex;flex-direction:column;gap:12px;box-shadow:0 1px 2px rgba(20,26,43,.06)}.msg{background:#fff;border-radius:16px;padding:12px 14px;font-weight:700;font-size:14px;box-shadow:inset 0 0 0 2px ${couleur}}
.tete{display:flex;align-items:center;gap:10px}.tete b{font-size:20px;font-weight:800}.pt{width:12px;height:12px;border-radius:50%}.pt.ok{background:#12805c}.pt.ko{background:#b42318}
button{width:100%;min-height:56px;border:0;border-radius:16px;font:800 17px 'Plus Jakarta Sans',system-ui,sans-serif;color:#fff;background:var(--c,${couleur});cursor:pointer}
button.rouge{background:#141a2b}button.vert{background:#12805c}button.sec{background:#fff;color:#141a2b;box-shadow:inset 0 0 0 2px #d9dce7}
label{display:block;font-size:13px;font-weight:700;color:#5b6479}input[type=number],input[type=time],input[type=search],input[type=datetime-local],input[type=text],select{width:100%;height:48px;border:0;border-radius:12px;padding:0 12px;font:700 16px 'Plus Jakarta Sans',system-ui,sans-serif;background:#f0f1f6;color:#141a2b;margin-top:6px}
input:focus{outline:0;box-shadow:inset 0 0 0 2px ${couleur}}
.u{display:flex;align-items:center;gap:8px}.u input{flex:1}.grille{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
.case{display:flex;align-items:center;gap:10px;font-weight:700;color:#141a2b}.case input{width:22px;height:22px}
body[data-v] [data-vue]{display:none}${VUES.map((v) => `body[data-v=${v}] [data-vue=${v}]`).join(',')}{display:flex;flex-direction:column;gap:14px}
nav.bas{position:fixed;left:0;right:0;bottom:0;z-index:20;display:grid;grid-template-columns:repeat(3,1fr);background:#fff;border-top:1px solid #e6e8f0;padding:8px 8px calc(14px + env(safe-area-inset-bottom))}
nav.bas a{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;min-height:56px;color:#5b6479;font-size:12px;font-weight:700;text-decoration:none}nav.bas a[aria-current=page]{color:${couleur}}
a.ligne{display:flex;align-items:center;gap:14px;padding:16px;border-radius:22px;background:#fff;color:#141a2b;text-decoration:none;box-shadow:0 1px 2px rgba(20,26,43,.06)}a.ligne.fort{outline:2px solid ${couleur};outline-offset:-2px}
.pic{width:48px;height:48px;border-radius:14px;background:#f0f1f6;display:grid;place-items:center;flex:none}.fort .pic{background:#e6efff;color:${couleur}}
.tx{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}.tx b{font-size:16px;font-weight:800}.tx span{font-size:13px;color:#5b6479;line-height:1.35}.tx .cpt{font-size:12px;font-weight:700;color:${couleur};margin-top:2px}.ch{font-size:22px;color:#5b6479}
.retour{display:inline-flex;align-items:center;min-height:44px;color:${couleur};font-weight:700;font-size:15px;text-decoration:none}
.rech{display:flex;align-items:center;gap:10px;min-height:52px;background:#fff;border-radius:16px;padding:0 16px;box-shadow:0 1px 2px rgba(20,26,43,.06);color:#5b6479}.rech input{flex:1;height:50px;margin:0;padding:0;background:transparent}
.filtres{display:flex;gap:8px;flex-wrap:wrap}.filtres button{width:auto;min-height:44px;padding:0 18px;border-radius:22px;font-size:14px;background:#fff;color:#141a2b;box-shadow:0 1px 2px rgba(20,26,43,.06)}.filtres button[aria-pressed=true]{background:#141a2b;color:#fff}
.liste{display:flex;flex-direction:column;gap:10px}.resto{display:flex;align-items:center;gap:12px;min-height:64px;padding:10px 14px;border-radius:18px;background:#fff;color:#141a2b;text-decoration:none;box-shadow:0 1px 2px rgba(20,26,43,.06)}.resto .av{width:42px;height:42px;border-radius:12px;background:#e6efff;color:${couleur};display:grid;place-items:center;font-weight:800;flex:none}.resto .nm{flex:1;min-width:0;display:flex;flex-direction:column;gap:3px;font-weight:800;font-size:15px}.resto .bd{display:flex;gap:6px;flex-wrap:wrap}.resto .bd i{font-style:normal;border-radius:10px;padding:2px 8px;font-size:12px;font-weight:700;background:#fff1d6;color:#8a4b00}
.info{background:#e6efff;border-radius:16px;padding:12px 14px;font-size:13px;line-height:1.45;color:#143a7a}.info b{font-weight:800}
details.pctb{background:#fff;border-radius:16px;padding:0 14px;box-shadow:0 1px 2px rgba(20,26,43,.06)}details.pctb summary{min-height:48px;display:flex;align-items:center;font-weight:700;font-size:14px;color:${couleur};cursor:pointer}details.pctb[open]{padding-bottom:14px}
.pct{display:flex;gap:8px;align-items:flex-end;margin-top:8px}.pct label{flex:1}.pct button{width:auto;flex:none;padding:0 18px;background:#141a2b;font-size:15px}
.plat{display:flex;flex-direction:column;gap:8px;border-radius:18px;background:#fff;box-shadow:0 1px 2px rgba(20,26,43,.06);padding:14px}.plat.mod{outline:2px solid #e09a1a;outline-offset:-2px}
.l1{display:flex;align-items:center;gap:12px}.nm{flex:1;display:flex;flex-direction:column;gap:3px;min-width:0}.nm b{font-size:15px;font-weight:800}.tag{display:none;align-self:flex-start;background:#fff1d6;color:#8a4b00;border-radius:8px;padding:2px 8px;font-size:11px;font-weight:800}.plat.mod .tag{display:inline}
.px{display:flex;align-items:center;gap:6px;background:#f0f1f6;border-radius:12px;padding:0 12px;min-height:48px;margin:0;flex:none}.px input{width:72px;height:44px;margin:0;padding:0;text-align:right;font-size:17px;font-weight:800;background:transparent}.px span{font-size:12px;font-weight:700;color:#5b6479}.plat.pm .px{background:#fff8ea;box-shadow:inset 0 0 0 2px #e09a1a}
.l2{display:flex;align-items:center;gap:8px;font-size:13px;color:#5b6479}.sub{flex:1}.sub b{color:#141a2b}.ini{display:none}.plat.pm .ini{display:inline}.l2 .lien{display:none}.plat.mod .l2 .lien{display:block}
button.lien{width:auto;min-height:44px;padding:0 6px;background:transparent;color:${couleur};font-size:13px;font-weight:700}
.ind{display:flex;align-items:center;margin:0;align-self:flex-start;cursor:pointer}.ind input{position:absolute;opacity:0;width:1px;height:1px}.ind span{display:flex;align-items:center;min-height:44px;padding:0 14px;border-radius:12px;box-shadow:inset 0 0 0 2px #d9dce7;font-size:13px;font-weight:700;color:#141a2b}.ind input:checked+span{background:#fdecea;box-shadow:inset 0 0 0 2px #b42318;color:#b42318}.ind input:focus-visible+span{outline:2px solid ${couleur};outline-offset:2px}
.barre{position:fixed;left:0;right:0;bottom:calc(78px + env(safe-area-inset-bottom));z-index:19;padding:12px 16px;background:#fff;border-top:1px solid #e6e8f0}.barre button{max-width:560px;display:block;margin:0 auto}
input.gros{height:64px;font-size:28px;text-align:center}.resto .pr{font-weight:800;font-size:14px;white-space:nowrap}
.hero{display:flex;align-items:center;gap:14px;padding:18px;border-radius:24px;background:var(--c);color:#fff}.hero .em{font-size:34px;width:60px;height:60px;border-radius:18px;background:rgba(255,255,255,.22);display:grid;place-items:center;flex:none}.hero h1{color:#fff;font-size:22px}.hero p{color:rgba(255,255,255,.92);margin-top:2px}
.astuce{background:#fff8d6;border-radius:18px;padding:14px 16px;font-size:15px;line-height:1.5;color:#5a4300;box-shadow:inset 0 0 0 2px #f1d46b}.astuce b{display:block;margin-bottom:2px;font-size:15px}.astuce p{color:#5a4300;font-size:15px}
.champ2{display:flex;flex-direction:column;gap:6px;font-size:16px;font-weight:800;color:#141a2b}.champ2 .aide{font-size:13px;font-weight:500;color:#5b6479;line-height:1.4}.champ2 input,.champ2 select{margin-top:0}.champ2 .u span{font-size:15px;font-weight:800;color:#5b6479;min-width:28px}
.etape{display:flex;align-items:center;gap:10px;font-size:16px;font-weight:800;margin-top:6px}.etape i{font-style:normal;width:30px;height:30px;border-radius:50%;background:var(--c);color:#fff;display:grid;place-items:center;font-size:15px;flex:none}
.exemple{background:var(--t);border-radius:18px;padding:14px 16px;font-size:15px;line-height:1.65;color:#141a2b;box-shadow:inset 0 0 0 2px var(--c)}.exemple b{color:var(--c)}.exemple .t{font-weight:800;font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:var(--c);display:block;margin-bottom:4px}
.interr{display:flex;align-items:center;gap:14px;min-height:64px;padding:12px 16px;border-radius:18px;background:var(--t);font-size:16px;font-weight:800;cursor:pointer;margin:0;color:#141a2b}.interr input{width:26px;height:26px;accent-color:var(--c);flex:none}
.cartereg{display:flex;align-items:center;gap:14px;padding:14px 16px;border-radius:22px;background:#fff;text-decoration:none;color:#141a2b;box-shadow:0 1px 2px rgba(20,26,43,.06);border-inline-start:8px solid var(--c)}.cartereg .em{font-size:28px;width:52px;height:52px;border-radius:16px;display:grid;place-items:center;flex:none;background:var(--t)}.cartereg .tx b{font-size:17px}.cartereg .etat{font-size:13px;font-weight:700;color:var(--c)}
.choix{display:flex;flex-direction:column;gap:10px}.choix label{display:flex;align-items:flex-start;gap:12px;padding:14px;border-radius:18px;background:#f0f1f6;color:#141a2b;font-size:15px;font-weight:800;cursor:pointer;margin:0}.choix input{width:24px;height:24px;margin:2px 0 0;accent-color:var(--c);flex:none}.choix small{display:block;font-weight:500;color:#5b6479;font-size:13px;margin-top:2px}.choix label:has(input:checked){background:var(--t);box-shadow:inset 0 0 0 2px var(--c)}
.promo{display:flex;flex-direction:column;gap:8px;padding:16px;border-radius:20px;background:#fff;box-shadow:inset 0 0 0 2px var(--c)}.promo.off{box-shadow:inset 0 0 0 2px #d9dce7;opacity:.75}.promo b{font-size:17px}.promo span{font-size:14px;line-height:1.5}
.msg.ok{background:#e3f5ed;color:#0b5a40;box-shadow:inset 0 0 0 2px #12805c}.msg.ko{background:#fdecea;color:#8a1c12;box-shadow:inset 0 0 0 2px #b42318}
.groupe{margin:6px 0 -4px;font-size:13px;font-weight:800;letter-spacing:.08em;text-transform:uppercase}
.liste-reg{background:#fff;border-radius:22px;box-shadow:0 1px 2px rgba(20,26,43,.06);overflow:hidden}.liste-reg a{display:flex;align-items:center;gap:12px;padding:12px 16px;min-height:56px;text-decoration:none;color:#141a2b;border-bottom:1px solid #eef0f6}.liste-reg a:last-child{border-bottom:0}.liste-reg .pt2{width:12px;height:12px;border-radius:50%;flex:none}.liste-reg .tt{flex:1;min-width:0;font-size:16px;font-weight:700}.liste-reg .chip{font-size:12px;font-weight:800;border-radius:10px;padding:3px 8px;background:#f0f1f6;color:#5b6479}.liste-reg .chip.on{background:var(--t);color:var(--c)}
.deux{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.tuile{display:flex;flex-direction:column;gap:6px;padding:16px;border-radius:22px;background:#fff;text-decoration:none;color:#141a2b;box-shadow:0 1px 2px rgba(20,26,43,.06);border-top:6px solid var(--c)}.tuile b{font-size:16px;font-weight:800;line-height:1.2}.tuile span{font-size:13px;font-weight:700;color:#5b6479}.tuile span.on{color:var(--c)}
.onglets{display:grid;grid-template-columns:1fr 1fr;gap:4px;padding:5px;border-radius:20px;background:#e8ebf3}.onglets a{display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:54px;border-radius:16px;text-decoration:none;color:#5b6479;font-size:15px;font-weight:800}.onglets a small{font-size:12px;font-weight:600}.onglets a.on{background:var(--c);color:#fff}
/* --- Maquette « Page de config livreur » : mêmes rayons, mêmes tailles, mêmes couleurs --- */
.hero{margin:6px 0 0;padding:20px;border-radius:26px}.hero .em{width:60px;height:60px;border-radius:18px;color:#fff}.hero h1,.hero h2{letter-spacing:-.01em}
details.astuce{margin:14px 0 0;border-radius:20px;background:#fff8d6;box-shadow:inset 0 0 0 2px #f1d46b;padding:0;overflow:hidden;color:#5a4300}
details.astuce summary{display:flex;align-items:center;gap:10px;padding:14px 16px;min-height:44px;font-size:15px;font-weight:800;color:#5a4300;cursor:pointer;list-style:none}details.astuce summary::-webkit-details-marker{display:none}details.astuce summary span:nth-child(2){flex:1;text-align:left}details.astuce summary span:first-child{flex:none;display:grid}details.astuce summary .chev{transition:transform .15s}details.astuce:not([open]) summary .chev{transform:rotate(180deg)}
details.astuce .ast{padding:0 16px 16px;font-size:15px;line-height:1.5;color:#5a4300}details.astuce .ast p{color:#5a4300;font-size:15px}details.astuce .ast p+p{margin-top:6px}
.exemple{background:#fff;border-radius:24px;padding:18px;box-shadow:inset 0 0 0 2px var(--c)}
.interr{border-radius:18px;min-height:56px;gap:14px;padding:14px 16px}.interr input[type=checkbox]{order:2;margin-left:auto;appearance:none;-webkit-appearance:none;width:58px;height:34px;border-radius:17px;background:#cbd2e1;position:relative;flex:none;cursor:pointer;margin-top:0;margin-bottom:0}.interr input[type=checkbox]::after{content:'';position:absolute;top:4px;left:4px;width:26px;height:26px;border-radius:50%;background:#fff;transition:left .15s}.interr input[type=checkbox]:checked{background:var(--c)}.interr input[type=checkbox]:checked::after{left:28px}
.champ2 input,.champ2 select{height:56px;border-radius:14px;padding:0 16px;font-size:20px}.champ2 .aide{font-size:13px;line-height:1.4}
input[type=number],input[type=time],input[type=search],input[type=datetime-local],input[type=text],select{height:56px}
.carte{border-radius:24px}
form.carte>button:not(.sec):not(.rouge):not(.lien):not([type=button]){position:sticky;bottom:92px;z-index:5;min-height:56px;border-radius:16px;box-shadow:0 -10px 14px -6px rgba(255,255,255,.95),0 -1px 0 #e6e8f0}
.retour{font-weight:800}.retour svg{vertical-align:-4px}
.tit{color:#5b6479}
.sw{display:flex;align-items:center;width:52px;min-width:52px;height:32px;min-height:32px;border-radius:16px;border:0;padding:3px;cursor:pointer;text-decoration:none;background:#cbd2e1;justify-content:flex-start}.sw.on{justify-content:flex-end;background:var(--c)}.sw i{width:26px;height:26px;border-radius:50%;background:#fff;display:block}.sw.gd{width:64px;min-width:64px;height:38px;min-height:38px;border-radius:19px;padding:4px}.sw.gd i{width:30px;height:30px}
.entete{display:flex;align-items:center;gap:12px;margin-top:8px}.entete .av2{width:46px;height:46px;border-radius:14px;color:#fff;display:grid;place-items:center;font-size:20px;font-weight:800;flex:none}.entete b{display:block;font-size:20px;font-weight:800;letter-spacing:-.01em}.entete span{font-size:14px;color:#5b6479;font-weight:500}
.statut{margin-top:6px;padding:18px;border-radius:24px;background:#141a2b;color:#fff;display:flex;align-items:center;gap:14px}.statut .tx2{flex:1;min-width:0}.statut b{display:flex;align-items:center;gap:8px;font-size:18px;font-weight:800}.statut b i{width:12px;height:12px;border-radius:50%;background:#3ddc84;display:block}.statut b i.ko{background:#ff6b6b}.statut p{color:#c9d0e4;font-size:14px;margin-top:4px;line-height:1.4}
.tuile .haut{display:flex;justify-content:space-between;align-items:flex-start}.tuile .em2{width:44px;height:44px;border-radius:14px;background:var(--t);color:var(--c);display:grid;place-items:center}.tuile{gap:10px}
.tuile .pastille{align-self:flex-start;font-size:12px;font-weight:800;border-radius:10px;padding:3px 8px;background:var(--t);color:var(--c)}
.cartereg .em{color:var(--c);width:48px;height:48px;border-radius:15px}.cartereg .em svg,.tuile .em2 svg{width:24px;height:24px}.cartereg .tx{gap:2px}.cartereg .etat{display:inline-block;align-self:flex-start;margin-top:6px;font-size:12px;font-weight:800;color:var(--c);background:var(--t);border-radius:10px;padding:3px 8px}.cartereg .etat.off{color:#5b6479;background:#f0f1f6}
.liste-reg .chip:not(.on){background:none;padding:0;font-size:13px;color:#5b6479}
form.carte button.sec,form.carte button.lien{background:transparent;box-shadow:none;color:var(--c);min-height:48px;font-size:15px;border-radius:14px}
.barres{display:flex;flex-direction:column;gap:12px}.barres .lg{display:flex;align-items:center;gap:12px}.barres .lg span:first-child{width:70px;font-size:15px;font-weight:700}.barres .pist{flex:1;height:10px;border-radius:5px;background:var(--t);position:relative}.barres .pist i{position:absolute;left:0;top:0;bottom:0;border-radius:5px;background:var(--c)}.barres .lg span:last-child{width:84px;text-align:right;font-size:15px;font-weight:800}.barres+.note{font-size:13px;color:#5b6479;margin-top:12px;line-height:1.4}
.prog{display:flex;gap:6px;margin-top:4px}.prog i{flex:1;height:6px;border-radius:3px;background:var(--t)}.prog i.on{background:var(--c)}.progl{display:flex;justify-content:space-between;gap:8px;font-size:13px;font-weight:700;color:#5b6479;margin:8px 0 4px}
.nav2{display:grid;grid-template-columns:1fr 2fr;gap:10px;position:sticky;bottom:92px;z-index:5;background:#fff;padding:10px 0 2px;box-shadow:0 -10px 14px -6px rgba(255,255,255,.95)}.nav2 button{min-height:56px}form.carte .nav2 button.sec{background:#f0f1f6;color:#141a2b;box-shadow:none;font-size:16px}
.resume .code{display:flex;align-items:center;gap:12px;padding:12px 14px;border-radius:14px;background:var(--t);border:2px dashed var(--c);margin-bottom:14px;color:var(--c)}.resume .code b{flex:1;font-size:22px;font-weight:800;letter-spacing:.12em}
.resume .rg{display:flex;flex-direction:column;gap:8px;font-size:15px;line-height:1.4}.resume .rg div{display:flex;justify-content:space-between;gap:10px}.resume .rg div span{color:#5b6479}.resume .rg div.fin{padding-top:8px;border-top:1px solid #eef0f6}.resume .rg div.fin b{color:var(--c)}
.prix2{display:flex;flex-direction:column;gap:16px}.prix2 .lb{display:flex;align-items:center;gap:10px;font-size:16px;font-weight:800;margin-bottom:8px}.prix2 .lb .pic2{width:34px;height:34px;border-radius:11px;display:grid;place-items:center;flex:none}
.prix2 input.gros{height:64px;font-size:28px;text-align:center;border-radius:16px}
.liaison{display:flex;align-items:center;gap:12px;padding:0 6px}.liaison .tr{flex:1;height:2px;background:repeating-linear-gradient(90deg,#cbd2e1 0 6px,transparent 6px 12px)}.liaison .pil{display:inline-flex;align-items:center;gap:6px;padding:8px 14px;border-radius:999px;background:#e3f5ed;color:#0b6b3f;font-size:14px;font-weight:800}.liaison .pil.neg{background:#fdecea;color:#b42318}
.resbar{display:flex;height:16px;border-radius:8px;overflow:hidden;margin-bottom:12px}.resleg{display:flex;flex-direction:column;gap:10px;font-size:15px}.resleg div{display:flex;align-items:center;gap:8px}.resleg i{width:12px;height:12px;border-radius:4px;flex:none}.resleg span{flex:1;color:#5b6479}.resleg div.tot{padding-top:10px;border-top:1px solid #eef0f6}.resleg div.tot span{color:#141a2b;font-weight:800}.resleg div.tot b{font-size:18px}
details.astuce .ast b{display:inline;margin:0;font-size:inherit}.prix2 .lb{color:#141a2b}
.barre-save{position:fixed;left:0;right:0;bottom:0;z-index:30;background:#fff;border-top:1px solid #e6e8f0;padding:12px 20px calc(22px + env(safe-area-inset-bottom))}.barre-save.haute{bottom:calc(78px + env(safe-area-inset-bottom));padding-bottom:12px}.barre-save>div{max-width:560px;margin:0 auto;display:flex;flex-direction:column;gap:8px}.barre-save>div>button{position:static!important;box-shadow:none!important}.barre-save .nav2{position:static;box-shadow:none;padding:0}.barre-save button.sec,.barre-save button.lien{background:transparent;color:var(--c);box-shadow:none;min-height:48px;font-size:15px}.barre-save .nav2 button.sec{background:#f0f1f6;color:#141a2b;font-size:16px}.barre-save button.rouge{background:transparent;color:#b42318;min-height:48px;font-size:15px}
.titre-ecran{padding:6px 4px 0}.titre-ecran h1{font-size:26px;letter-spacing:-.02em}
${ECRANS_REGLAGE.map((v) => `body[data-v=${v}] nav.bas`).join(',')}{display:none}
small.pied{display:block;margin-top:6px;color:#5b6479;font-size:13px;text-align:center}
${cmd.css}
.alerte-cmd{display:flex;align-items:center;justify-content:space-between;gap:10px;background:#fff;border-radius:20px;padding:16px 18px;text-decoration:none;color:inherit;border:2px solid ${couleur}}.alerte-cmd b{font-size:18px}.alerte-cmd span{background:${couleur};color:#fff;border-radius:999px;padding:4px 12px;font-weight:800}
</style></head><body><main>
${message ? `<div class="msg ${message.startsWith('❌') ? 'ko' : 'ok'}">${echapper(message)}</div>` : ''}

<div data-vue="commandes">${cmd.html}</div>

<div data-vue="accueil">
<div class="entete"><div class="av2" style="background:${couleur}">${echapper(livreur.nom.charAt(0).toUpperCase())}</div><div><b>${echapper(livreur.nom)}</b><span>Mon espace livreur</span></div></div>
<a class="alerte-cmd" href="#commandes"><b>🛵 Commandes</b><span>${nbEnCours} en cours</span></a>
<section class="statut" id="service">
<div class="tx2"><b><i class="${pause ? 'ko' : ''}"></i>${pause ? 'Site en pause' : 'Site ouvert'}</b><p>${pause ? `Les clients voient les menus mais ne peuvent pas commander.${config.retour ? ` Retour annoncé ${quand(config.retour, maintenant)} : les commandes reprennent toutes seules.` : ''}` : 'Vos clients peuvent commander maintenant.'}</p></div>
<form method="post" style="margin:0">${champCle}<input type="hidden" name="action" value="${pause ? 'reprendre' : 'pause'}"><button type="submit" role="switch" aria-checked="${pause ? 'false' : 'true'}" aria-label="${pause ? 'Reprendre les commandes' : 'Mettre le site en pause'}" class="sw gd${pause ? '' : ' on'}" style="--c:#3ddc84"><i></i></button></form>
</section>
<h2 class="tit">Raccourcis</h2>
${raccourcis}
</div>

<div data-vue="reglages">
<div><h1 style="font-size:28px">Mes réglages</h1><p class="sous" style="font-size:15px">Touchez un sujet. Chaque page explique à quoi il sert.</p></div>
${groupesReglages}
</div>

<div data-vue="horaires" style="--c:#6d4aff;--t:#efeaff">
<a class="retour" href="#reglages">← Réglages</a>
<div class="hero"><span class="em" aria-hidden="true">⏰</span><div><h1>Horaires</h1><p>Quand les clients peuvent commander</p></div></div>
<div class="astuce"><b>💡 À quoi ça sert ?</b><p>Vous choisissez les heures de travail. En dehors de ces heures, le site se ferme tout seul et affiche « fermé ». Vous n’avez rien à faire.</p></div>
<form method="post" class="carte" id="f-horaires">${champCle}<input type="hidden" name="action" value="horaires">
<label class="interr"><input type="checkbox" name="auto" id="h-auto"${service ? ' checked' : ''}> Fermer le site automatiquement</label>
<div class="grille">
<label class="champ2">Je commence à<input type="time" name="ouvre" id="h-ouvre" value="${service?.ouvre ?? '11:00'}"><span class="aide">Les commandes commencent à cette heure.</span></label>
<label class="champ2">Je finis à<input type="time" name="ferme" id="h-ferme" value="${service?.ferme ?? '23:00'}"><span class="aide">Les commandes s’arrêtent. Après minuit (ex. 02:00) : c’est normal.</span></label>
</div>
<div class="exemple" id="h-ex"><span class="t">Résultat</span><span id="h-txt"></span></div>
<button>Enregistrer les horaires</button>
</form>
<form method="post" class="carte" id="f-pause" style="--c:#141a2b">${champCle}<input type="hidden" name="action" value="${pause ? 'reprendre' : 'pause'}">
<h2>Pause avec heure de retour</h2>
${pause ? `<p>Le site est en pause${config.retour ? `, retour annoncé ${quand(config.retour, maintenant)}` : ''}. Les commandes reprennent toutes seules à l’heure de retour.</p><button class="vert">Reprendre les commandes</button>` : `<p>Vous devez vous absenter ? Mettez le site en pause : les clients voient l’heure de votre retour, et les commandes reprennent toutes seules.</p><label class="champ2">Je reviens à<input type="datetime-local" name="retour" value="${dansUneHeure}"><span class="aide">Facultatif. Vide = pause sans heure.</span></label><button class="rouge">Mettre en pause</button>`}
</form>
</div>

<div data-vue="frais" style="--c:#1a6be0;--t:#e6efff">
<a class="retour" href="#reglages">← Réglages</a>
<div class="hero"><span class="em" aria-hidden="true">🛵</span><div><h1>Frais de livraison</h1><p>Ce que le client paie pour la livraison</p></div></div>
<div class="astuce"><b>💡 À quoi ça sert ?</b><p>Le prix de la livraison grandit avec la distance entre le resto et le client. Prix = <b style="display:inline">départ + prix par km × nombre de km</b>. Cet argent est pour vous.</p></div>
<form method="post" class="carte" id="f-frais" data-facteur="${livraison.facteurRoute}">${champCle}<input type="hidden" name="action" value="frais">
<label class="champ2">Prix de départ<span class="u"><input type="number" inputmode="decimal" step="0.1" min="0" name="base" value="${nb(livraison.base)}" required><span>DT</span></span><span class="aide">Ce que le client paie même pour une très courte distance.</span></label>
<label class="champ2">Prix par kilomètre<span class="u"><input type="number" inputmode="decimal" step="0.1" min="0" name="parKm" value="${nb(livraison.parKm)}" required><span>DT</span></span><span class="aide">Ajouté pour chaque kilomètre entre le resto et le client.</span></label>
<div class="grille">
<label class="champ2">Jamais moins de<span class="u"><input type="number" inputmode="decimal" step="0.1" min="0" name="min" value="${nb(livraison.min)}" required><span>DT</span></span></label>
<label class="champ2">Jamais plus de<span class="u"><input type="number" inputmode="decimal" step="0.1" min="0" name="max" value="${nb(livraison.max)}" required><span>DT</span></span></label>
</div>
<label class="champ2">Distance maximale<span class="u"><input type="number" inputmode="decimal" step="0.5" min="0" name="rayonMaxKm" value="${nb(livraison.rayonMaxKm)}" required><span>km</span></span><span class="aide">Si le client est plus loin, le site refuse la commande.</span></label>
<div class="exemple"><span class="t">Exemples de prix</span><span id="fr-ex"></span></div>
<p>Le prix est arrondi à 0,5 DT au-dessus. Les km sont calculés en ligne droite puis augmentés pour imiter la route.</p>
<button>Enregistrer les frais de livraison</button>
</form>
</div>

<div data-vue="annonce" style="--c:#e67700;--t:#fff4e0">
<a class="retour" href="#reglages">← Réglages</a>
<div class="hero"><span class="em" aria-hidden="true">📢</span><div><h1>Message d’annonce</h1><p>Un message en haut du site</p></div></div>
<div class="astuce"><b>💡 À quoi ça sert ?</b><p>Vous écrivez une phrase courte. Tous les clients la voient en haut du site, sur toutes les pages. Par exemple : « Fermé jeudi » ou « Plus de livraison après 22 h ».</p></div>
<form method="post" class="carte" id="f-annonce">${champCle}<input type="hidden" name="action" value="annonce">
<label class="champ2">Votre message<input type="text" name="texte" id="an-texte" maxlength="140" value="${echapper(rg.annonce ?? '')}" placeholder="Ex. Fermé jeudi, retour vendredi 11 h"><span class="aide">140 lettres au maximum. Écrivez simple.</span></label>
<div class="exemple"><span class="t">Ce que le client voit en haut du site</span><span id="an-ex"></span></div>
<button name="an" value="on">📢 Publier le message</button>
${rg.annonce ? '<button name="an" value="off" class="rouge">Retirer le message</button>' : ''}
</form>
</div>

<div data-vue="supplement" style="--c:#0c8599;--t:#e3fafc">
<a class="retour" href="#reglages">← Réglages</a>
<div class="hero"><span class="em" aria-hidden="true">🌧️</span><div><h1>Supplément pluie / nuit</h1><p>Un petit plus sur la livraison</p></div></div>
<div class="astuce"><b>💡 À quoi ça sert ?</b><p>Quand il pleut, aux heures de rush ou la nuit, livrer coûte plus d’efforts. Vous ajoutez <b style="display:inline">un petit supplément au prix de la livraison</b>. Il est <b style="display:inline">pour vous</b> et le client le voit sur une ligne à part. Si la livraison est gratuite, il n’y a pas de supplément.</p></div>
<form method="post" class="carte" id="f-sup">${champCle}<input type="hidden" name="action" value="supplement">
<div class="etape"><i>1</i>Le bouton « pluie » (vous l’allumez et l’éteignez vous-même)</div>
<label class="interr"><input type="checkbox" name="sm_actif" id="sm-actif"${rg.supplement?.manuel?.actif ? ' checked' : ''}> Supplément allumé maintenant</label>
<div class="grille">
<label class="champ2">Son nom<input type="text" name="sm_libelle" id="sm-lib" maxlength="30" value="${echapper(rg.supplement?.manuel?.libelle ?? 'Pluie')}"><span class="aide">Vu par le client. Ex. Pluie, Rush.</span></label>
<label class="champ2">Montant<span class="u"><input type="number" inputmode="decimal" step="0.1" min="0" max="50" name="sm_montant" id="sm-mt" value="${rg.supplement?.manuel ? nb(rg.supplement.manuel.montant) : '1'}"><span>DT</span></span></label>
</div>
<div class="etape"><i>2</i>Automatique la nuit</div>
<label class="interr"><input type="checkbox" name="sn_actif" id="sn-actif"${rg.supplement?.nuit?.actif ? ' checked' : ''}> Supplément de nuit</label>
<div class="grille">
<label class="champ2">De<input type="time" name="sn_de" value="${rg.supplement?.nuit?.de ?? '22:00'}"></label>
<label class="champ2">À<input type="time" name="sn_a" value="${rg.supplement?.nuit?.a ?? '06:00'}"></label>
</div>
<label class="champ2">Montant de nuit<span class="u"><input type="number" inputmode="decimal" step="0.1" min="0" max="50" name="sn_montant" id="sn-mt" value="${rg.supplement?.nuit ? nb(rg.supplement.nuit.montant) : '1'}"><span>DT</span></span><span class="aide">Ajouté tout seul entre ces deux heures, heure de Tunis.</span></label>
<div class="exemple"><span class="t">Exemple</span><span id="sp-ex"></span></div>
<button>Enregistrer</button>
</form>
</div>

<div data-vue="minimum" style="--c:#364fc9;--t:#e7ecff">
<a class="retour" href="#reglages">← Réglages</a>
<div class="hero"><span class="em" aria-hidden="true">🧮</span><div><h1>Commande minimum</h1><p>Pas de petites commandes</p></div></div>
<div class="astuce"><b>💡 À quoi ça sert ?</b><p>Le client ne peut pas commander s’il prend <b style="display:inline">moins que ce montant de plats</b>. Utile pour ne pas faire une course qui ne rapporte presque rien. La livraison ne compte pas dans ce montant.</p></div>
<form method="post" class="carte" id="f-min">${champCle}<input type="hidden" name="action" value="minimum">
<label class="champ2">Montant minimum de plats<span class="u"><input type="number" inputmode="decimal" step="0.5" min="0" name="mn_val" id="mn-val" value="${rg.commandeMin ?? ''}" placeholder="10"><span>DT</span></span><span class="aide">Exemple : 10 → le client doit commander au moins 10 DT de plats.</span></label>
<div class="exemple"><span class="t">Ce que le client voit</span><span id="mn-ex"></span></div>
<button>Enregistrer le minimum</button>
${rg.commandeMin ? '<button name="mn" value="off" class="sec">Pas de minimum</button>' : ''}
</form>
</div>

<div data-vue="pourboires" style="--c:#ae3ec9;--t:#f8ebfc">
<a class="retour" href="#reglages">← Réglages</a>
<div class="hero"><span class="em" aria-hidden="true">🙏</span><div><h1>Montants de pourboire</h1><p>Les boutons proposés au client</p></div></div>
<div class="astuce"><b>💡 À quoi ça sert ?</b><p>Avant de valider sa commande, le client peut laisser un pourboire. Vous choisissez <b style="display:inline">les montants proposés</b> (6 au maximum). Tout le pourboire est <b style="display:inline">pour vous</b>. Il y a toujours un bouton « Aucun ».</p></div>
<form method="post" class="carte" id="f-pb">${champCle}<input type="hidden" name="action" value="pourboires">
<div class="grille">${[0, 1, 2, 3, 4, 5].map((i) => `<label class="champ2">Bouton ${i + 1}<span class="u"><input type="number" inputmode="decimal" step="0.5" min="0" max="50" name="pb${i + 1}" value="${rg.pourboires[i] ?? ''}" placeholder="—"><span>DT</span></span></label>`).join('')}</div>
<p>Laissez une case vide pour enlever ce bouton.</p>
<div class="exemple"><span class="t">Boutons vus par le client</span><span id="pb-ex"></span></div>
<button>Enregistrer les montants</button>
<button type="submit" name="reset" value="1" class="sec">Remettre 1, 2, 3 et 5 DT</button>
</form>
</div>

<div data-vue="colis" style="--c:#7048e8;--t:#efe9ff">
<a class="retour" href="#reglages">← Réglages</a>
<div class="hero"><span class="em" aria-hidden="true">📦</span><div><h1>Tarif des colis</h1><p>Le prix pour envoyer un colis</p></div></div>
<div class="astuce"><b>💡 À quoi ça sert ?</b><p>Un colis n’est pas un repas : vous pouvez avoir <b style="display:inline">votre propre prix</b> et demander <b style="display:inline">un supplément</b> pour les gros colis. Les promos, coupons, frais de service et livraison gratuite ne s’appliquent pas aux colis. Tant que vous n’enregistrez rien ici, les colis coûtent comme la livraison d’un repas.</p></div>
<form method="post" class="carte" id="f-colis" data-facteur="${livraison.facteurRoute}">${champCle}<input type="hidden" name="action" value="colis">
<label class="interr"><input type="checkbox" name="c_actif"${colisConf.actif ? ' checked' : ''}> Je prends les demandes de colis</label>
<label class="champ2">Prix de départ<span class="u"><input type="number" inputmode="decimal" step="0.1" min="0" name="base" value="${nb(colisConf.livraison.base)}" required><span>DT</span></span><span class="aide">Ce que le client paie même pour une très courte distance.</span></label>
<label class="champ2">Prix par kilomètre<span class="u"><input type="number" inputmode="decimal" step="0.1" min="0" name="parKm" value="${nb(colisConf.livraison.parKm)}" required><span>DT</span></span><span class="aide">Ajouté pour chaque kilomètre entre le ramassage et la livraison.</span></label>
<div class="grille">
<label class="champ2">Jamais moins de<span class="u"><input type="number" inputmode="decimal" step="0.1" min="0" name="min" value="${nb(colisConf.livraison.min)}" required><span>DT</span></span></label>
<label class="champ2">Jamais plus de<span class="u"><input type="number" inputmode="decimal" step="0.1" min="0" name="max" value="${nb(colisConf.livraison.max)}" required><span>DT</span></span></label>
</div>
<label class="champ2">Distance maximale<span class="u"><input type="number" inputmode="decimal" step="0.5" min="0" name="rayonMaxKm" value="${nb(colisConf.livraison.rayonMaxKm)}" required><span>km</span></span><span class="aide">Si le colis va plus loin, la demande est refusée.</span></label>
<div class="etape"><i>+</i>Supplément selon la taille du colis</div>
<div class="grille">
<label class="champ2">Colis moyen<span class="u"><input type="number" inputmode="decimal" step="0.1" min="0" name="c_moyen" value="${nb(colisConf.supplements.moyen)}"><span>DT</span></span><span class="aide">Sac, boîte.</span></label>
<label class="champ2">Colis grand<span class="u"><input type="number" inputmode="decimal" step="0.1" min="0" name="c_grand" value="${nb(colisConf.supplements.grand)}"><span>DT</span></span><span class="aide">Carton jusqu’à 10 kg.</span></label>
</div>
<p>Un petit colis (enveloppe, clés) n’a jamais de supplément de taille.</p>
<div class="etape"><i>+</i>Colis urgent</div>
<label class="champ2">Supplément « dès que possible »<span class="u"><input type="number" inputmode="decimal" step="0.1" min="0" name="c_urgent" value="${nb(colisConf.urgent)}"><span>DT</span></span><span class="aide">Ajouté quand le client ne choisit pas d’heure et veut son colis tout de suite. 0 = pas de supplément.</span></label>
<div class="etape"><i>+</i>Colis de nuit</div>
<label class="interr"><input type="checkbox" name="c_nuit_actif"${colisConf.nuit ? ' checked' : ''}> Supplément automatique la nuit</label>
<div class="grille">
<label class="champ2">De<input type="time" name="c_nuit_de" value="${colisConf.nuit?.de ?? '22:00'}"></label>
<label class="champ2">À<input type="time" name="c_nuit_a" value="${colisConf.nuit?.a ?? '06:00'}"></label>
</div>
<label class="champ2">Montant de nuit<span class="u"><input type="number" inputmode="decimal" step="0.1" min="0" name="c_nuit_mt" value="${colisConf.nuit ? nb(colisConf.nuit.montant) : '1'}"><span>DT</span></span><span class="aide">Selon l’heure de ramassage choisie par le client (ou l’heure actuelle s’il veut tout de suite). Heure de Tunis.</span></label>
<div class="exemple"><span class="t">Exemples de prix à 3 km</span><span id="co-ex"></span></div>
<button>Enregistrer le tarif des colis</button>
<button type="submit" name="reset" value="1" class="sec">Remettre comme la livraison des repas</button>
</form>
</div>

<div data-vue="livraison-gratuite" style="--c:#0f8f7e;--t:#dff5f1">
<a class="retour" href="#reglages">← Réglages</a>
<div class="hero"><span class="em" aria-hidden="true">🎁</span><div><h1>Livraison gratuite</h1><p>Offrez la livraison à vos clients</p></div></div>
<div class="astuce"><b>💡 À quoi ça sert ?</b><p>Le client ne paie <b style="display:inline">pas la livraison</b>. Une bande bien visible l’annonce sur tout le site pour attirer les commandes. La livraison offerte est <b style="display:inline">à votre charge</b> : vous ne l’encaissez pas.</p></div>
<div class="carte" style="gap:14px"><div class="tete"><span class="pt ${livraisonGratuite ? 'ok' : 'ko'}"></span><b>${livraisonGratuite ? 'La livraison est gratuite' : 'La livraison est payante'}</b></div>
${livraisonGratuite ? `<p>${livraisonGratuite.min ? `Gratuite pour les commandes de <b>${dt(livraisonGratuite.min)}</b> de plats ou plus.` : 'Gratuite pour toutes les commandes.'}</p>` : '<p>Vos clients paient la livraison normalement.</p>'}
<form method="post" id="f-gratuite" style="display:flex;flex-direction:column;gap:12px">${champCle}<input type="hidden" name="action" value="livraison-gratuite">
<label class="champ2">Seulement dès un montant de commande (facultatif)<span class="u"><input type="number" inputmode="decimal" step="0.5" min="0" name="fg_min" id="fg-min" value="${livraisonGratuite?.min ?? ''}" placeholder="—"><span>DT</span></span><span class="aide">Exemple : 30 → la livraison est gratuite si le client commande au moins 30 DT de plats. Laissez vide pour que ce soit gratuit pour tous.</span></label>
<div class="exemple"><span class="t">Ce que le client voit</span><span id="fg-ex"></span></div>
<button name="fg" value="on">🎁 ${livraisonGratuite ? 'Enregistrer' : 'Mettre la livraison gratuite'}</button>
${livraisonGratuite ? '<button name="fg" value="off" class="rouge">Arrêter la livraison gratuite</button>' : ''}
</form></div>
</div>

<div data-vue="frais-service" style="--c:#12805c;--t:#e3f5ed">
<a class="retour" href="#reglages">← Réglages</a>
<div class="hero"><span class="em" aria-hidden="true">💰</span><div><h1>Frais de service</h1><p>Un petit plus pour vous, sur chaque commande</p></div></div>
<div class="astuce"><b>💡 À quoi ça sert ?</b><p>C’est un petit supplément que le client paie <b style="display:inline">en plus de la livraison</b>, comme sur les applications de livraison. Cet argent est <b style="display:inline">pour vous</b>. Le client le voit sur une ligne à part.</p></div>
<form method="post" class="carte" id="f-fs">${champCle}<input type="hidden" name="action" value="frais-service">
<label class="interr"><input type="checkbox" name="fs_actif" id="fs-actif"${fraisService ? ' checked' : ''}> Ajouter des frais de service</label>
<label class="champ2">Pourcentage des plats<span class="u"><input type="number" inputmode="decimal" step="0.5" min="0" max="100" name="fs_pourcent" id="fs-pct" value="${nb((fraisService ?? FRAIS_SERVICE_ZIGZAG).pourcent)}"><span>%</span></span><span class="aide">Exemple : 8 % → pour 10 DT de repas, le client paie 0,800 DT de frais.</span></label>
<div class="grille">
<label class="champ2">Jamais moins de<span class="u"><input type="number" inputmode="decimal" step="0.05" min="0" name="fs_min" id="fs-min" value="${nb((fraisService ?? FRAIS_SERVICE_ZIGZAG).min)}"><span>DT</span></span><span class="aide">Pour les petites commandes.</span></label>
<label class="champ2">Jamais plus de<span class="u"><input type="number" inputmode="decimal" step="0.05" min="0" name="fs_max" id="fs-max" value="${nb((fraisService ?? FRAIS_SERVICE_ZIGZAG).max)}"><span>DT</span></span><span class="aide">Pour les grosses commandes.</span></label>
</div>
<div class="exemple"><span class="t">Ce que le client paie en frais</span><span id="fs-ex"></span></div>
<button>Enregistrer</button>
<button type="submit" name="defaut" value="1" class="sec">Remettre la formule Zigzag (8 %, min 0,8, max 5)</button>
</form>
</div>

<div data-vue="commission" style="--c:#d9650b;--t:#fdeedd">
${menu ? `<a class="retour" href="?cle=${encodeURIComponent(cle)}#commission">← Tous les restos</a>
<div class="hero"><span class="em" aria-hidden="true">📊</span><div><h1>${echapper(menu.resto.nom)}</h1><p>Votre commission sur ce resto</p></div></div>
<form method="post" class="carte" id="f-com">${champCle}<input type="hidden" name="resto" value="${echapper(menu.resto.slug)}"><input type="hidden" name="action" value="commission-resto">
<label class="champ2">Commission<span class="u"><input type="number" inputmode="decimal" step="0.5" min="0" max="100" name="ct_resto" id="ct-resto" value="${com?.restos[menu.resto.slug] ?? ''}" placeholder="0"><span>%</span></span><span class="aide">Vide ou 0 : pas de commission.</span></label>
<div class="exemple"><span class="t">Exemple</span><span id="ct-ex"></span></div>
<button>Enregistrer</button>
</form>` : `<a class="retour" href="#reglages">← Réglages</a>
<div class="hero"><span class="em" aria-hidden="true">📊</span><div><h1>Commission par resto</h1><p>Un pourcentage du prix du resto que vous gardez</p></div></div>
<label class="rech"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg><input type="search" id="cherchecom" placeholder="Chercher un resto…" aria-label="Chercher un resto"></label>
<div class="liste" id="listecom">${[...restos].sort((a, b) => Number(com?.restos[b.slug] !== undefined) - Number(com?.restos[a.slug] !== undefined)).map((r) => `<a class="resto" data-nom="${echapper(r.nom.toLowerCase())}" href="?cle=${encodeURIComponent(cle)}&resto=${echapper(r.slug)}#commission"><span class="nm">${echapper(r.nom)}</span><span class="pr">${com?.restos[r.slug] !== undefined ? `${nb(com.restos[r.slug])} %` : ''}</span><span class="ch" aria-hidden="true">›</span></a>`).join('')}</div>
<script>(function(){var l=document.getElementById('listecom'),c=document.getElementById('cherchecom');c.addEventListener('input',function(){var q=c.value.toLowerCase();[].slice.call(l.children).forEach(function(r){r.style.display=r.dataset.nom.indexOf(q)>=0?'':'none'})})})();</script>`}
</div>

<div data-vue="promos" style="--c:#d6336c;--t:#fde7ef">
<a class="retour" href="#reglages">← Réglages</a>
<div class="titre-ecran"><h1>Une remise pour vos clients</h1></div>
<div class="onglets"><a href="#promos" class="on">Promotion<small>automatique</small></a><a href="#coupons">Coupon<small>avec un code</small></a></div>
<div class="astuce"><b>💡 À quoi ça sert ?</b><p>Une promotion se met <b style="display:inline">toute seule</b> sur la commande : le client n’a rien à taper. Par exemple « −10 % ce week-end ». Vous choisissez <b style="display:inline">qui paie la remise</b> : vous, le resto, ou vous deux. Une seule promotion à la fois par commande.</p><p style="margin-top:6px">Pour une remise avec <b style="display:inline">un code à donner</b> à un client, allez dans <a href="#coupons" style="font-weight:800;color:#a61e4d">🎟️ Coupons</a>.</p></div>
<form method="post" class="carte" id="f-promo">${champCle}<input type="hidden" name="action" value="promo-ajouter"><h2>Créer une promotion</h2>
<div class="etape"><i>1</i>Son nom</div>
<label class="champ2">Nom<input type="text" name="nom" id="p-nom" maxlength="60" placeholder="Ex. Week-end" required><span class="aide">Le client voit ce nom dans son panier et sur le site.</span></label>
<div class="etape"><i>2</i>La remise</div>
<div class="grille">
<label class="champ2">Type<select name="type" id="p-type"><option value="pourcent">En pourcentage (%)</option><option value="montant">En dinars (DT)</option></select></label>
<label class="champ2">Valeur<input type="number" inputmode="decimal" step="0.1" min="0.1" name="valeur" id="p-val" required placeholder="10"></label>
</div>
<div class="etape"><i>3</i>Quand ça marche ? <small style="font-weight:500;color:#5b6479">(facultatif)</small></div>
<div class="grille">
<label class="champ2">Remise maximum<span class="u"><input type="number" inputmode="decimal" step="0.1" min="0" name="max" id="p-max" placeholder="—"><span>DT</span></span><span class="aide">Pour ne pas donner trop (pour les %).</span></label>
<label class="champ2">Panier minimum<span class="u"><input type="number" inputmode="decimal" step="0.1" min="0" name="min" id="p-min" placeholder="—"><span>DT</span></span><span class="aide">Le client doit commander au moins ça.</span></label>
</div>
<label class="champ2">Pour quel resto ?<select name="resto"><option value="">Tous les restos</option>${restos.map((r) => `<option value="${echapper(r.slug)}">${echapper(r.nom)}</option>`).join('')}</select></label>
<div class="etape"><i>4</i>Qui paie la remise ?</div>
<div class="choix">
<label><input type="radio" name="financeur" value="livreur" checked><span>Moi, le livreur<small>La remise est retirée de mon gain. Le resto est payé normalement.</small></span></label>
<label><input type="radio" name="financeur" value="resto"><span>Le resto<small>La remise est retirée de ce que je donne au resto. Mon gain ne change pas.</small></span></label>
<label><input type="radio" name="financeur" value="partage"><span>Nous deux<small>On partage la remise.</small></span></label>
</div>
<label class="champ2" id="p-partb" style="display:none">Part payée par le resto<span class="u"><input type="number" inputmode="numeric" step="1" min="1" max="99" name="partResto" id="p-part" value="50"><span>%</span></span><span class="aide">Le reste est payé par vous.</span></label>
<div class="exemple resume"><span class="t">Résumé de votre promotion</span><span id="p-ex"></span></div>
<button>Créer la promotion</button>
</form>
${promosListe ? `<h2 class="tit">Mes promotions</h2>${promosListe}` : ''}
</div>

<div data-vue="coupons" style="--c:#a61e4d;--t:#ffdeeb">
<a class="retour" href="#reglages">← Réglages</a>
<div class="titre-ecran"><h1>Une remise pour vos clients</h1></div>
<div class="onglets"><a href="#promos">Promotion<small>automatique</small></a><a href="#coupons" class="on">Coupon<small>avec un code</small></a></div>
<div class="astuce"><b>💡 À quoi ça sert ?</b><p>Un coupon est <b style="display:inline">un code</b> (par exemple BIENVENUE10) que vous donnez à un client. Il le tape dans son panier pour avoir la remise. <b style="display:inline">Les autres clients ne le voient jamais.</b> Vous choisissez qui paie la remise : vous, le resto, ou vous deux.</p><p style="margin-top:6px">Pour une remise qui s’applique <b style="display:inline">toute seule</b>, sans code, allez dans <a href="#promos" style="font-weight:800;color:#d6336c">🏷️ Promotions</a>.</p></div>
<form method="post" class="carte" id="f-coupon">${champCle}<input type="hidden" name="action" value="coupon-ajouter"><h2>Créer un coupon</h2>
<div class="etape"><i>1</i>Son code</div>
<label class="champ2">Le code à donner au client<input type="text" name="code" id="c-code" maxlength="20" placeholder="Ex. BIENVENUE10" autocapitalize="characters" autocomplete="off" required><span class="aide">3 à 20 lettres ou chiffres, sans espace. Le client le tape dans son panier et voit « Coupon » suivi de ce code.</span></label>
<div class="etape"><i>2</i>La remise</div>
<div class="grille">
<label class="champ2">Type<select name="type" id="c-type"><option value="pourcent">En pourcentage (%)</option><option value="montant">En dinars (DT)</option></select></label>
<label class="champ2">Valeur<input type="number" inputmode="decimal" step="0.1" min="0.1" name="valeur" id="c-val" required placeholder="10"></label>
</div>
<div class="etape"><i>3</i>Quand ça marche ? <small style="font-weight:500;color:#5b6479">(facultatif)</small></div>
<div class="grille">
<label class="champ2">Remise maximum<span class="u"><input type="number" inputmode="decimal" step="0.1" min="0" name="max" id="c-max" placeholder="—"><span>DT</span></span><span class="aide">Pour ne pas donner trop (pour les %).</span></label>
<label class="champ2">Panier minimum<span class="u"><input type="number" inputmode="decimal" step="0.1" min="0" name="min" id="c-min" placeholder="—"><span>DT</span></span><span class="aide">Le client doit commander au moins ça.</span></label>
</div>
<label class="champ2">Pour quel resto ?<select name="resto"><option value="">Tous les restos</option>${restos.map((r) => `<option value="${echapper(r.slug)}">${echapper(r.nom)}</option>`).join('')}</select></label>
<div class="etape"><i>4</i>Qui paie la remise ?</div>
<div class="choix">
<label><input type="radio" name="financeur" value="livreur" checked><span>Moi, le livreur<small>La remise est retirée de mon gain. Le resto est payé normalement.</small></span></label>
<label><input type="radio" name="financeur" value="resto"><span>Le resto<small>La remise est retirée de ce que je donne au resto. Mon gain ne change pas.</small></span></label>
<label><input type="radio" name="financeur" value="partage"><span>Nous deux<small>On partage la remise.</small></span></label>
</div>
<label class="champ2" id="c-partb" style="display:none">Part payée par le resto<span class="u"><input type="number" inputmode="numeric" step="1" min="1" max="99" name="partResto" id="c-part" value="50"><span>%</span></span><span class="aide">Le reste est payé par vous.</span></label>
<div class="etape"><i>5</i>Options <small style="font-weight:500;color:#5b6479">(facultatif)</small></div>
<label class="interr" style="min-height:56px"><input type="checkbox" name="cumulable"> Le coupon s’ajoute aux promotions automatiques</label>
<label class="champ2">Nombre maximum d’utilisations<input type="number" inputmode="numeric" step="1" min="1" name="limite" placeholder="Ex. 50"><span class="aide">Quand le code a servi autant de fois, il ne marche plus. Vide = sans limite.</span></label>
<div class="exemple resume"><span class="t">Résumé de votre coupon</span><span id="c-ex"></span></div>
<button>Créer le coupon</button>
</form>
${couponsListe ? `<h2 class="tit">Mes coupons</h2>${couponsListe}` : ''}
</div>

<div data-vue="prix" style="--c:#2b8a3e;--t:#ebfbee">
${menu ? `<a class="retour" href="?cle=${encodeURIComponent(cle)}#prix">← Tous les restos</a>
<div class="hero"><span class="em" aria-hidden="true">🍽️</span><div><h1>${echapper(menu.resto.nom)}</h1><p>${rg.restosFermes.includes(menu.resto.slug) ? '⛔ Fermé pour vos clients' : 'Prix, plats et fermeture de ce resto'}</p></div></div>
<div class="astuce"><b>💡 Comment ça marche ?</b><p>Dans la case de chaque plat, tapez <b style="display:inline">le prix que le client paie</b>. Le resto, lui, vous le payez au prix du menu : <b style="display:inline">la différence est votre majoration</b>.${textMaj === 'aucune' ? '' : ` La majoration automatique de <b style="display:inline">${textMaj}</b> s’ajoute toute seule au prix du resto si vous ne changez rien.`} Quand vous avez fini, touchez le gros bouton « Enregistrer » en bas.</p></div>
<form method="post" id="fplats" style="display:flex;flex-direction:column;gap:12px">${champCle}<input type="hidden" name="resto" value="${echapper(menu.resto.slug)}">
<div class="etape"><i>1</i>Les prix des plats</div>
<label class="rech"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg><input type="search" id="cherche" placeholder="Chercher un plat…" aria-label="Chercher un plat"></label>
<div class="filtres" role="group" aria-label="Filtrer les plats"><button type="button" data-f="" aria-pressed="true">Tous</button><button type="button" data-f="mod" aria-pressed="false">Modifiés</button><button type="button" data-f="indispo" aria-pressed="false">Indispo</button></div>
<div class="liste">${lignesPlats}</div>
${Object.keys(corrections).length ? '<button name="action" value="plats-reset" class="sec">Revenir aux prix initiaux pour tout ce resto</button>' : ''}
<div class="barre"><button name="action" value="plats" id="nbmod">Enregistrer</button></div>
</form>
<script>
(function(){var f=document.getElementById('fplats'),rows=[].slice.call(f.querySelectorAll('.plat')),filtre='';
function fmt(n){return n.toFixed(3).replace('.',',')+' DT'}
function pin(r){return r.querySelector('.px input')}
function etat(r){var i=pin(r),c=r.querySelector('input[type=checkbox]'),v=i.value.trim()===''?NaN:Number(i.value.replace(',','.')),init=Number(r.dataset.init),pm=!isNaN(v)&&v!==init,mod=pm||c.checked;
r.classList.toggle('mod',mod);r.classList.toggle('pm',pm);r.dataset.mod=mod?'1':'';r.dataset.ind=c.checked?'1':'';r.querySelector('.cli').textContent=fmt(Math.round(((isNaN(v)?init:v)-Number(r.dataset.resto))*1000)/1000);return mod}
function tout(){var n=0,q=document.getElementById('cherche').value.toLowerCase();rows.forEach(function(r){if(etat(r))n++;var ok=r.dataset.nom.indexOf(q)>=0&&(filtre===''||(filtre==='mod'?r.dataset.mod:r.dataset.ind));r.style.display=ok?'':'none'});
document.getElementById('nbmod').textContent=n?'Enregistrer '+n+' changement'+(n>1?'s':''):'Enregistrer'}
rows.forEach(function(r){r.addEventListener('input',tout);r.querySelector('[data-reset]').addEventListener('click',function(){pin(r).value=fmt(Number(r.dataset.init)).replace(' DT','');r.querySelector('input[type=checkbox]').checked=false;tout()})});
document.getElementById('cherche').addEventListener('input',tout);
[].slice.call(f.querySelectorAll('.filtres button')).forEach(function(b){b.addEventListener('click',function(){filtre=b.dataset.f;[].slice.call(f.querySelectorAll('.filtres button')).forEach(function(x){x.setAttribute('aria-pressed',x===b?'true':'false')});tout()})});
tout()})();
</script>
<div class="etape" style="margin-top:10px"><i>2</i>Réglages de ce resto</div>
<form method="post" class="carte" id="fferme" style="--c:#b42318;--t:#fdecea">${champCle}<input type="hidden" name="resto" value="${echapper(menu.resto.slug)}"><input type="hidden" name="action" value="resto-ferme">
<div class="tete"><span class="pt ${rg.restosFermes.includes(menu.resto.slug) ? 'ko' : 'ok'}"></span><b>${rg.restosFermes.includes(menu.resto.slug) ? 'Ce resto est fermé pour vos clients' : 'Ce resto est ouvert aux commandes'}</b></div>
<p>${rg.restosFermes.includes(menu.resto.slug) ? 'Les clients voient le resto grisé « Indisponible » et ne peuvent pas commander.' : 'Le resto est en panne, trop lent ou fermé ? Fermez-le : les clients ne pourront plus y commander, jusqu’à ce que vous le rouvriez.'}</p>
<button name="f" value="${rg.restosFermes.includes(menu.resto.slug) ? '0' : '1'}" class="${rg.restosFermes.includes(menu.resto.slug) ? 'vert' : 'rouge'}">${rg.restosFermes.includes(menu.resto.slug) ? '✅ Rouvrir ce resto' : '⛔ Fermer ce resto'}</button></form>
` : `<a class="retour" href="#reglages">← Réglages</a>
<div class="hero"><span class="em" aria-hidden="true">💶</span><div><h1>Plats et restos</h1><p>Prix, plats indisponibles, fermeture</p></div></div>
<div class="astuce"><b>💡 À quoi ça sert ?</b><p>Un resto a changé un prix ? Touchez-le, puis changez le prix du plat. Vous pouvez aussi <b style="display:inline">fermer un resto</b>.${nbCorriges ? ` Pour le moment : <b style="display:inline">${nbCorriges} plat${nbCorriges > 1 ? 's' : ''} modifié${nbCorriges > 1 ? 's' : ''}</b> dans ${nbRestosCorriges} resto${nbRestosCorriges > 1 ? 's' : ''}.` : ''}</p></div>
<div class="etape"><i>1</i>Touchez un resto</div>
<label class="rech"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg><input type="search" id="cherchereso" placeholder="Chercher un resto…" aria-label="Chercher un resto"></label>
<div class="filtres" role="group" aria-label="Filtrer les restos"><button type="button" data-r="" aria-pressed="true">Tous</button><button type="button" data-r="mod" aria-pressed="false">Modifiés · ${nbRestosCorriges}</button></div>
<div class="liste" id="listeresto">${restos
      .map((r) => {
        const k = compte(r.slug);
        const badges = `${rg.restosFermes.includes(r.slug) ? '<i style="background:#fdecea;color:#b42318">⛔ fermé</i>' : ''}${k.prix ? `<i>${k.prix} prix modifié${k.prix > 1 ? 's' : ''}</i>` : ''}${k.indispo ? `<i>${k.indispo} indispo</i>` : ''}`;
        return `<a class="resto" data-nom="${echapper(r.nom.toLowerCase())}" data-mod="${k.prix || k.indispo ? '1' : ''}" href="?cle=${encodeURIComponent(cle)}&resto=${echapper(r.slug)}#prix"><span class="av" aria-hidden="true">${echapper(r.nom.charAt(0).toUpperCase())}</span><span class="nm">${echapper(r.nom)}${badges ? `<span class="bd">${badges}</span>` : ''}</span><span class="ch" aria-hidden="true">›</span></a>`;
      })
      .join('')}</div>
<script>
(function(){var l=document.getElementById('listeresto'),c=document.getElementById('cherchereso'),f='';var rows=[].slice.call(l.children);
function t(){var q=c.value.toLowerCase();rows.forEach(function(r){r.style.display=r.dataset.nom.indexOf(q)>=0&&(f===''||r.dataset.mod)?'':'none'})}
c.addEventListener('input',t);[].slice.call(document.querySelectorAll('[data-r]')).forEach(function(b){b.addEventListener('click',function(){f=b.dataset.r;[].slice.call(document.querySelectorAll('[data-r]')).forEach(function(x){x.setAttribute('aria-pressed',x===b?'true':'false')});t()})})})();
</script>`}
</div>

<div data-vue="simple" style="--c:#2b8a3e;--t:#ebfbee">${(() => {
    const base = `?cle=${encodeURIComponent(cle)}&simple=1`;
    const cherche = (id: string, ph: string) => `<label class="rech"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg><input type="search" id="c${id}" placeholder="${ph}" aria-label="${ph}"></label>`;
    const filtre = (id: string) => `<script>(function(){var l=document.getElementById('l${id}'),c=document.getElementById('c${id}');c.addEventListener('input',function(){var q=c.value.toLowerCase();[].slice.call(l.children).forEach(function(r){r.style.display=r.dataset.nom.indexOf(q)>=0?'':'none'})})})();</script>`;
    if (!menu)
      return `<a class="retour" href="#accueil">← Accueil</a>
<div class="hero"><span class="em" aria-hidden="true">✏️</span><div><h1>Changer le prix d’un plat</h1><p>3 touches : resto, plat, prix</p></div></div>
<div class="etape"><i>1</i>Touchez le resto</div>${cherche('r', 'Chercher un resto…')}
<div class="liste" id="lr">${modifiesDabord(restos.map((r) => ({ r, n: compte(r.slug).prix })))
        .map(({ r, n }) => `<a class="resto" data-nom="${echapper(r.nom.toLowerCase())}" href="${base}&resto=${echapper(r.slug)}#simple"><span class="av" aria-hidden="true">${echapper(r.nom.charAt(0).toUpperCase())}</span><span class="nm">${echapper(r.nom)}${n ? `<span class="bd"><i>${n} prix modifié${n > 1 ? 's' : ''}</i></span>` : ''}</span><span class="ch" aria-hidden="true">›</span></a>`)
        .join('')}</div>${filtre('r')}`;
    const p = plat === null ? undefined : menu.menu.plats.find((x) => x.id === plat);
    const slugR = echapper(menu.resto.slug);
    if (!p)
      return `<a class="retour" href="${base}#simple">← Autres restos</a>
<div class="hero"><span class="em" aria-hidden="true">🍽️</span><div><h1>${echapper(menu.resto.nom)}</h1><p>Quel plat a changé de prix ?</p></div></div>
<div class="etape"><i>2</i>Touchez le plat</div>${cherche('p', 'Chercher un plat…')}
<div class="liste" id="lp">${menu.menu.plats.map((x) => { const c = corrections[x.id]?.prix; return `<a class="resto" data-nom="${echapper(x.nom.toLowerCase())}" href="${base}&resto=${slugR}&plat=${x.id}#simple"><span class="nm">${echapper(x.nom)}${c !== undefined ? '<span class="bd"><i>prix modifié</i></span>' : ''}</span><span class="pr">${dt(c ?? clients.get(x.id) ?? x.prix)}</span><span class="ch" aria-hidden="true">›</span></a>`; }).join('')}</div>${filtre('p')}`;
    const defautClient = clients.get(p.id) ?? p.prix;
    const eff = corrections[p.id]?.prix ?? defautClient;
    return `<a class="retour" href="${base}&resto=${slugR}#simple">← Autres plats</a>
<div class="hero"><span class="em" aria-hidden="true">🍔</span><div><h1>${echapper(p.nom)}</h1><p>${echapper(menu.resto.nom)}</p></div></div>
<div class="astuce"><b>💡 Comment ça marche ?</b><p>Il y a <b>deux prix</b> : ce que <b>le resto vous demande</b>, et ce que <b>le client paie</b>. La différence est <b>votre majoration</b>.</p></div>
<form method="post" class="prix2" id="f-px" data-menu="${p.prix}">${champCle}<input type="hidden" name="resto" value="${slugR}"><input type="hidden" name="plat" value="${p.id}"><input type="hidden" name="action" value="prix1">
<div class="carte">
<div><label for="px-resto" class="lb"><span class="pic2" style="background:#ebfbee;color:#2b8a3e"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 10 12 3l9 7v10H3z"/><path d="M9 20v-6h6v6"/></svg></span>Le resto vous le vend à</label><div class="u"><input class="gros" type="text" inputmode="decimal" name="prix_resto" id="px-resto" value="${saisie(restoEff(p))}" required style="flex:1"><span style="font-size:17px;font-weight:800;color:#5b6479;min-width:40px">DT</span></div><span class="aide" style="display:block;font-size:13px;color:#5b6479;margin-top:8px;line-height:1.4;font-weight:500">Le prix actuel chez le resto. C’est ce que vous lui payez. Le menu du site dit : ${dt(p.prix)}.</span></div>
<div class="liaison"><span class="tr"></span><span class="pil" id="px-pil"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg><span id="px-marge">Votre majoration ${dt(eff - restoEff(p))}</span></span><span class="tr"></span></div>
<div><label for="px-val" class="lb"><span class="pic2" style="background:#e6efff;color:#1a6be0"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg></span>Le client paie</label><div class="u"><input class="gros" type="text" inputmode="decimal" name="prix" id="px-val" value="${saisie(eff)}" required style="flex:1"><span style="font-size:17px;font-weight:800;color:#5b6479;min-width:40px">DT</span></div><span class="aide" style="display:block;font-size:13px;color:#5b6479;margin-top:8px;line-height:1.4;font-weight:500">En dinars, par exemple 12,5.</span></div>
</div>
<div class="exemple" style="--c:#2b8a3e"><span class="t">Résultat</span>
<div class="resbar"><span id="px-br" style="background:#2b8a3e;width:${eff > 0 ? Math.min(100, Math.round((restoEff(p) / eff) * 1000) / 10) : 0}%"></span><span id="px-bm" style="background:#8ce99a;flex:1"></span></div>
<div class="resleg"><div><i style="background:#2b8a3e"></i><span>Pour le resto</span><b id="px-lr">${dt(restoEff(p))}</b></div><div><i style="background:#8ce99a"></i><span>Votre majoration</span><b id="px-lm">${dt(eff - restoEff(p))}</b></div><div class="tot"><span>Le client paie</span><b id="px-lc">${dt(eff)}</b></div></div></div>
<button>Enregistrer le prix</button></form>
<script>(function(){var i=document.getElementById('px-val'),r=document.getElementById('px-resto');if(!i||!r)return;function fmt(n){return (Math.round(n*1000)/1000).toFixed(3).replace('.',',')+' DT'}function num(e){return Number(e.value.replace(',','.'))}function maj(){var a=num(r),v=num(i),ok=isFinite(v)&&v>0&&isFinite(a)&&a>0,m=v-a,pil=document.getElementById('px-pil');document.getElementById('px-marge').textContent=ok?'Votre majoration '+fmt(m):'Votre majoration —';pil.className=ok&&m<0?'pil neg':'pil';document.getElementById('px-lr').textContent=ok?fmt(a):'—';document.getElementById('px-lm').textContent=ok?fmt(m):'—';document.getElementById('px-lc').textContent=ok?fmt(v):'—';document.getElementById('px-br').style.width=ok?Math.max(0,Math.min(100,a/v*100))+'%':'0%';document.getElementById('px-bm').style.display=ok&&m<=0?'none':''}i.addEventListener('input',maj);r.addEventListener('input',maj)})();</script>
<div class="carte" style="--c:#d6336c;--t:#fde7ef"><div class="hero"><span class="em" aria-hidden="true">🏷️</span><div><h2 style="color:#fff;font-size:18px">Mettre ce plat en promotion</h2><p>Une remise automatique, seulement sur ce plat</p></div></div>
<div class="astuce"><b>💡 À quoi ça sert ?</b><p>Le client voit un badge rose sur ce plat et la remise se met <b style="display:inline">toute seule</b> s’il le commande. Vous choisissez qui paie la remise.</p></div>
${promosEff.filter((x) => !x.code && x.plat === p.id && x.resto === menu.resto.slug).map((x) => carteP(x, 'promos', `<input type="hidden" name="resto" value="${slugR}"><input type="hidden" name="plat" value="${p.id}">`)).join('')}
<form method="post" style="display:flex;flex-direction:column;gap:12px">${champCle}<input type="hidden" name="resto" value="${slugR}"><input type="hidden" name="plat" value="${p.id}"><input type="hidden" name="action" value="promo-ajouter">
<label class="champ2">Nom (vu par le client)<input type="text" name="nom" maxlength="60" value="${echapper(`Promo ${p.nom}`.slice(0, 60))}" required></label>
<div class="grille"><label class="champ2">Type<select name="type"><option value="pourcent">En pourcentage (%)</option><option value="montant">En dinars (DT)</option></select></label><label class="champ2">Valeur<input type="number" inputmode="decimal" step="0.1" min="0.1" name="valeur" required placeholder="10"></label></div>
<div class="choix"><label><input type="radio" name="financeur" value="livreur" checked><span>Moi, le livreur<small>La remise est retirée de mon gain.</small></span></label><label><input type="radio" name="financeur" value="resto"><span>Le resto<small>La remise est retirée de ce que je donne au resto.</small></span></label><label><input type="radio" name="financeur" value="partage"><span>Nous deux<small>On partage la remise.</small></span></label></div>
<label class="champ2">Si « Nous deux » : part du resto<span class="u"><input type="number" inputmode="numeric" step="1" min="1" max="99" name="partResto" value="50"><span>%</span></span></label>
<button>Mettre ce plat en promotion</button></form></div>
<div class="carte" style="--c:#a61e4d;--t:#ffdeeb"><div class="hero"><span class="em" aria-hidden="true">🎟️</span><div><h2 style="color:#fff;font-size:18px">Coupon pour ce plat</h2><p>Une remise avec un code, seulement sur ce plat</p></div></div>
<div class="astuce"><b>💡 À quoi ça sert ?</b><p>Un coupon est <b style="display:inline">un code</b> que vous donnez à un client. Il le tape dans son panier et la remise s’applique sur ce plat. Les autres clients ne le voient pas.</p></div>
${promosEff.filter((x) => x.code && x.plat === p.id && x.resto === menu.resto.slug).map((x) => carteP(x, 'coupons', `<input type="hidden" name="resto" value="${slugR}"><input type="hidden" name="plat" value="${p.id}">`)).join('')}
<form method="post" style="display:flex;flex-direction:column;gap:12px">${champCle}<input type="hidden" name="resto" value="${slugR}"><input type="hidden" name="plat" value="${p.id}"><input type="hidden" name="action" value="coupon-ajouter">
<label class="champ2">Le code à donner au client<input type="text" name="code" maxlength="20" placeholder="Ex. PLAT10" autocapitalize="characters" autocomplete="off" required><span class="aide">3 à 20 lettres ou chiffres, sans espace.</span></label>
<div class="grille"><label class="champ2">Type<select name="type"><option value="pourcent">En pourcentage (%)</option><option value="montant">En dinars (DT)</option></select></label><label class="champ2">Valeur<input type="number" inputmode="decimal" step="0.1" min="0.1" name="valeur" required placeholder="10"></label></div>
<div class="choix"><label><input type="radio" name="financeur" value="livreur" checked><span>Moi, le livreur<small>La remise est retirée de mon gain.</small></span></label><label><input type="radio" name="financeur" value="resto"><span>Le resto<small>La remise est retirée de ce que je donne au resto.</small></span></label><label><input type="radio" name="financeur" value="partage"><span>Nous deux<small>On partage la remise.</small></span></label></div>
<label class="champ2">Si « Nous deux » : part du resto<span class="u"><input type="number" inputmode="numeric" step="1" min="1" max="99" name="partResto" value="50"><span>%</span></span></label>
<button>Créer le coupon pour ce plat</button></form></div></div>`;
  })()}</div>
<small class="pied">Gardez ce lien secret : il permet de modifier votre site.<br>Nom, couleurs et contacts : demandez à votre fournisseur du site.</small>
</main>
<nav class="bas" aria-label="Navigation"><a href="#commandes" data-n="commandes"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 5h10M9 12h10M9 19h10"/><path d="M4 5h.01M4 12h.01M4 19h.01"/></svg>Commandes</a><a href="#accueil" data-n="accueil"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m3 11 9-8 9 8"/><path d="M5 10v10h14V10"/></svg>Accueil</a><a href="#reglages" data-n="reglages"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2"/></svg>Réglages</a></nav>
<script>
(function(){var m={'':'accueil',commandes:'commandes',accueil:'accueil',service:'accueil',prix:'prix',simple:'simple',plats:'prix',reglages:'reglages',horaires:'horaires',frais:'frais',colis:'colis',supplement:'supplement',minimum:'minimum',pourboires:'pourboires',annonce:'annonce','livraison-gratuite':'livraison-gratuite','frais-service':'frais-service',commission:'commission',promos:'promos',coupons:'coupons'},R={prix:1,horaires:1,frais:1,colis:1,supplement:1,minimum:1,pourboires:1,annonce:1,'livraison-gratuite':1,'frais-service':1,commission:1,promos:1,coupons:1};
function v(){var h=location.hash.slice(1),k=m[h]||'accueil';if(location.search.indexOf('resto=')>=0&&!h)k=location.search.indexOf('simple=1')>=0?'simple':'prix';document.body.dataset.v=k;[].slice.call(document.querySelectorAll('nav.bas a')).forEach(function(a){a.dataset.n===(k==='simple'?'accueil':R[k]?'reglages':k)?a.setAttribute('aria-current','page'):a.removeAttribute('aria-current')});window.scrollTo(0,0);var e=h&&document.getElementById(h);}

function $(i){return document.getElementById(i)}
function n(el){var x=Number(String(el&&el.value||'').replace(',','.'));return isFinite(x)?x:0}
function f(x){return (Math.round(x*1000)/1000).toFixed(3).replace('.',',')+' DT'}
function ex(){
 var o=$('h-auto');if(o){$('h-txt').innerHTML=o.checked?'Les clients peuvent commander de <b>'+$('h-ouvre').value+'</b> à <b>'+$('h-ferme').value+'</b>, tous les jours.':'Le site est <b>toujours ouvert</b> (sauf si vous le mettez en pause).'}
 var fr=document.getElementById('f-frais');if(fr){var q=function(k){return n(fr.elements[k])},fac=Number(fr.dataset.facteur)||1.3,h=[];[1,3,6].forEach(function(d){var km=Math.round(d*fac*10)/10,b=q('base')+q('parKm')*km,r=Math.ceil(Math.round(b*1000)/500)/2,p=Math.min(q('max'),Math.max(q('min'),r));h.push('Client à <b>'+d+' km</b> du resto : <b>'+f(p)+'</b>')});$('fr-ex').innerHTML=h.join('<br>')}
 var fa=$('fs-actif');if(fa){var mxf=n($('fs-max')),pf=n($('fs-pct')),h=[];[5,15,40,80].forEach(function(b){var x=Math.round(Math.min(mxf,Math.max(n($('fs-min')),b*pf/100))*1000)/1000;h.push('<div class="lg"><span>'+b+' DT</span><span class="pist"><i style="width:'+(mxf>0?Math.round(x/mxf*100):0)+'%"></i></span><span>'+f(x)+'</span></div>')});$('fs-ex').innerHTML=fa.checked?'<div class="barres">'+h.join('')+'</div>'+(pf>0&&mxf>0?'<div class="note">Au-delà de '+(Math.round(mxf/pf*1000)/10)+' DT de repas, les frais restent à '+f(mxf).replace(',000','')+'.</div>':''):'Pas de frais de service : le client ne paie que le repas et la livraison.'}
 var an=$('an-texte');if(an){var tx=an.value.trim();$('an-ex').innerHTML=tx?'📢 <b>'+tx.replace(/</g,'&lt;')+'</b>':'Aucun message pour le moment.'}
 var mn=$('mn-val');if(mn){var mv=n(mn);$('mn-ex').innerHTML=mv>0?'Un client qui prend <b>'+f(mv/2)+'</b> de plats voit : « Commande minimum '+f(mv)+' de plats. Il vous manque <b>'+f(mv/2)+'</b>. »':'Pas de minimum : le client peut commander même un seul petit plat.'}
 var sp=$('sm-actif');if(sp){var l=[];if(sp.checked&&n($('sm-mt'))>0)l.push('« '+($('sm-lib').value||'Pluie')+' » : <b>+'+f(n($('sm-mt')))+'</b> sur la livraison');if($('sn-actif').checked&&n($('sn-mt'))>0)l.push('La nuit : <b>+'+f(n($('sn-mt')))+'</b> sur la livraison');$('sp-ex').innerHTML=l.length?l.join('<br>')+'<br>Le client voit une ligne « Supplément » et vous gardez cet argent.':'Aucun supplément : la livraison est au prix normal.'}
 var pb=$('f-pb');if(pb){var v=[];for(var i=1;i<=6;i++){var q=n(pb.elements['pb'+i]);if(q>0)v.push(q)}v=v.filter(function(x,j){return v.indexOf(x)===j}).sort(function(a,b){return a-b});$('pb-ex').innerHTML=['Aucun'].concat(v.map(function(x){return f(x).replace(',000','')})).map(function(x){return '<b>'+x+'</b>'}).join(' · ')}
 var co=document.getElementById('f-colis');if(co){var qc=function(k){return n(co.elements[k])},fc=Number(co.dataset.facteur)||1.3,km=Math.round(3*fc*10)/10,bc=qc('base')+qc('parKm')*km,rc=Math.ceil(Math.round(bc*1000)/500)/2,pc=Math.min(qc('max'),Math.max(qc('min'),rc));$('co-ex').innerHTML='Petit colis : <b>'+f(pc)+'</b><br>Colis moyen : <b>'+f(pc+qc('c_moyen'))+'</b><br>Colis grand : <b>'+f(pc+qc('c_grand'))+'</b>'+(qc('c_urgent')>0?'<br>Si urgent (pas d’heure) : <b>+'+f(qc('c_urgent'))+'</b>':'')+(co.elements['c_nuit_actif'].checked&&qc('c_nuit_mt')>0?'<br>Si ramassage de nuit : <b>+'+f(qc('c_nuit_mt'))+'</b>':'')}
 var fg=$('fg-min');if(fg){var mn=n(fg);$('fg-ex').innerHTML=mn>0?'Bande « 🛵 Livraison gratuite dès <b>'+f(mn).replace(',000','')+'</b> » · le client paie <b>0 DT</b> de livraison s’il commande au moins ça.':'Bande « 🛵 Livraison gratuite » · le client paie <b>0 DT</b> de livraison.'}
 var ct=$('ct-resto');if(ct){var pc=n(ct),g=Math.round(10*pc)/100;$('ct-ex').innerHTML=pc>0?'Le resto vend un repas <b>10 DT</b> : vous gardez <b>'+f(g)+'</b> et vous donnez <b>'+f(10-g)+'</b> au resto. Le client paie toujours 10 DT.':'Pas de commission : vous donnez au resto le prix complet.'}
 ['p','c'].forEach(function(pre){var pt=$(pre+'-type');if(!pt)return;var panier=20,v=n($(pre+'-val')),mn=n($(pre+'-min')),mx=n($(pre+'-max')),rem=pt.value==='montant'?v:panier*v/100;if(pt.value==='pourcent'&&mx>0)rem=Math.min(rem,mx);rem=Math.min(rem,panier);var fm=$(pre==='p'?'f-promo':'f-coupon'),fin=fm.querySelector('input[name=financeur]:checked').value,pr=fin==='resto'?100:fin==='partage'?n($(pre+'-part')):0,rr=Math.round(rem*pr*10)/1000;$(pre+'-partb').style.display=fin==='partage'?'':'none';var code=pre==='c'?($('c-code').value.trim().toUpperCase()||'VOTRE CODE'):'';var h=(pre==='c'?'<div class="code"><b>'+code.replace(/</g,'&lt;')+'</b></div>':'');if(v>0){h+=mn>panier?'<div class="rg"><div class="fin"><span>Ça ne marche pas pour 20 DT : il faut commander au moins '+f(mn)+'.</span></div></div>':'<div class="rg"><div><span>Remise</span><b>'+(pt.value==='montant'?f(v).replace(',000',''):String(v).replace('.',',')+' %')+(mx>0&&pt.value==='pourcent'?' (max '+f(mx).replace(',000','')+')':'')+'</b></div><div><span>Pour un repas de 20 DT</span><b>−'+f(rem)+'</b></div><div><span>Le client paie</span><b>'+f(panier-rem)+'</b></div><div class="fin"><span>Payée par</span><b>'+(fin==='livreur'?'vous : '+f(rem):fin==='resto'?'le resto : '+f(rem):'vous : '+f(rem-rr)+' · resto : '+f(rr))+'</b></div></div>'}else h+='<div class="rg"><div class="fin"><span>Tapez la valeur de la remise pour voir le résumé.</span></div></div>';$(pre+'-ex').innerHTML=h});
}
document.addEventListener('input',ex);document.addEventListener('change',ex);ex();
function wiz(f,noms){if(!f)return;var kids=[].slice.call(f.children),pas=[],cur=null,exm=null,env=null;kids.forEach(function(k){if(k.classList.contains('etape')){cur=document.createElement('section');cur.className='pas';pas.push(cur);f.insertBefore(cur,k)}
if(k.classList.contains('exemple')){exm=k;return}if(k.tagName==='BUTTON'){env=k;return}if(cur&&k.tagName!=='H2'&&!(k.tagName==='INPUT'&&k.type==='hidden'))cur.appendChild(k)});
if(pas.length<2||!exm||!env)return;var N=pas.length,i=0,prog=document.createElement('div'),lab=document.createElement('div'),nav=document.createElement('div');prog.className='prog';for(var q=0;q<N;q++)prog.appendChild(document.createElement('i'));lab.className='progl';nav.className='nav2';
var b1=document.createElement('button');b1.type='button';b1.className='sec';b1.textContent='Retour';var b2=document.createElement('button');b2.type='button';b2.textContent='Suivant';nav.appendChild(b1);nav.appendChild(b2);
var h2=f.querySelector('h2');f.insertBefore(prog,pas[0]);f.insertBefore(lab,pas[0]);f.insertBefore(nav,env);
function show(){pas.forEach(function(p,j){p.style.display=j===i?'flex':'none'});[].slice.call(prog.children).forEach(function(e,j){e.className=j<=i?'on':''});lab.innerHTML='<span>Étape '+(i+1)+' sur '+N+'</span><span>'+pas.map(function(p){return p.dataset.nom}).join(' · ')+'</span>';var last=i===N-1;exm.style.display=last?'':'none';env.style.display=last?'':'none';b2.style.display=last?'none':'';b1.style.display=i===0?'none':'';nav.style.gridTemplateColumns=i===0?'1fr':last?'1fr':'1fr 2fr';nav.style.display=last&&i===0?'none':'';window.scrollTo(0,0)}
b2.addEventListener('click',function(){var ok=true;[].slice.call(pas[i].querySelectorAll('input,select')).forEach(function(e){if(ok&&!e.checkValidity()){e.reportValidity();ok=false}});if(ok){i++;show()}});b1.addEventListener('click',function(){if(i>0){i--;show()}});
pas.forEach(function(p,j){p.style.flexDirection='column';p.style.gap='14px';p.dataset.nom=noms[j]||''});show()}
wiz(document.getElementById('f-promo'),['Nom','Remise','Conditions','Qui paie']);wiz(document.getElementById('f-coupon'),['Code','Remise','Conditions','Qui paie','Options']);
function barre(f,haute){if(!f)return;var bs=[].slice.call(f.children).filter(function(k){return k.tagName==='BUTTON'||k.classList.contains('nav2')});if(!bs.length)return;var b=document.createElement('div');b.className='barre-save'+(haute?' haute':'');var d=document.createElement('div');b.appendChild(d);bs.forEach(function(k){d.appendChild(k)});var sp=document.createElement('div');sp.style.height='150px';f.appendChild(sp);f.appendChild(b)}
['f-horaires','f-frais','f-colis','f-sup','f-min','f-pb','f-annonce','f-gratuite','f-fs','f-com','f-promo','f-coupon'].forEach(function(id){barre(document.getElementById(id),false)});barre(document.getElementById('f-px'),true);


window.addEventListener('hashchange',v);v()})();
</script><script>${cmd.js}</script></body></html>`);
}

// --- Colis --------------------------------------------------------------------------------------

/**
 * POST /api/colis : demande de livraison de colis. Valide, estime le prix avec les frais du livreur et lui envoie
 * un email pour qu'il appelle le client (rien n'est confirmé au client avant cet appel).
 */
export async function traiterColis(req: Request, env: Env, livreur: Livreur): Promise<Response> {
  if (autreOrigine(req)) return refus();
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return erreur(400, 'Demande invalide.');
  }
  const parsed = ColisSchema.safeParse(body);
  if (!parsed.success) return erreur(400, 'Merci de vérifier les adresses (placées sur la carte), le colis et les numéros.');

  const config = await lireConfigR2(env, livreur);
  const { service, colis: tarif } = reglages(livreur, config);
  const arret = messageArret(service, pauseEnCours(config, new Date()), new Date(), config.retour);
  if (arret) return erreur(400, arret);

  const colis = calculerColis(tarif, parsed.data);
  if ('erreur' in colis) return erreur(400, colis.erreur);

  const ref = refCommande();
  const html = htmlColis(colis, livreur, ref);
  await enregistrerFiche(env, livreur, ficheColis(colis, ref, new Date(), html));
  const [email] = await Promise.all([
    envoyerEmail(
    livreur.email,
    `Colis N° ${ref} — ${colis.client.nom} — appeler le ${colis.client.telephone.slice(3)}`,
    messageColis(colis, ref, livreur.nom),
    env,
    html,
    ),
    alerterPush(req, env, livreur),
  ]);
  // L'email est le seul canal automatique : on le signale au client s'il échoue (il peut écrire sur WhatsApp).
  if (email !== 'sent') console.error('[colis] email non envoyé', { ref, email });
  return Response.json({ ref, frais: colis.frais, km: colis.km, email, numeroWhatsApp: livreur.whatsapp });
}
