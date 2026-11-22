// Pure order logic, shared by the server route and the client cart.
// Type-only imports from server modules (they use fs).
import { z } from 'zod';
import type { Menu, Plat, RestoIndex } from './catalogue';
import { commissionMil, meilleurePromo, partRestoPourcent, pourcentCommission, promosAppliquees, repartirRemise } from './commission';
import { calculerFraisService } from './frais-service';
import { estOuvert, libelleHoraire } from './horaires';
import { calculerLivraison, type Point } from './livraison';
import { livraisonOfferte } from './livraison-gratuite';
import { supplementEnCours, type Supplement } from './regles-livreur';
import type { Livreur } from './livreur';
import { prixUnitaire, resumeChoix, validerChoix, type Choix } from './options';

export const CommandeInputSchema = z.object({
  restoSlug: z.string().min(1).max(120),
  lignes: z
    .array(
      z.object({
        platId: z.number().int().positive(),
        qte: z.number().int().min(1).max(50),
        choix: z.record(z.string().regex(/^\d{1,3}$/), z.array(z.number().int().min(0).max(200)).max(50)).default({}),
      }),
    )
    .min(1)
    .max(30),
  client: z.object({
    nom: z.string().trim().min(2).max(80),
    telephone: z.string().trim().min(8).max(20),
    adresse: z.string().trim().min(5).max(300),
    note: z.string().trim().max(300).optional(),
    // Facultatif : si présent, le client reçoit le récapitulatif et le montant à payer par email.
    email: z.string().trim().max(120).email().optional(),
  }),
  // Position GPS du client (navigateur) : sert au calcul des frais et au lien Maps pour le livreur.
  // `precision` (m) : présente seulement si le point vient directement du GPS ; absente = point posé sur la carte.
  position: z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180), precision: z.number().int().min(0).max(100000).optional() }),
  // Pourboire choisi par le client (DT), pour le livreur. Absent = aucun.
  pourboire: z.number().min(0).max(50).optional(),
  // Code coupon tapé par le client.
  code: z.string().trim().max(20).optional(),
});

export type CommandeInput = z.input<typeof CommandeInputSchema>;

export type CommandeCalculee = {
  resto: RestoIndex;
  /** `sousTotal` = prix client ; `sousTotalResto` = prix du resto (sans la majoration du livreur). */
  lignes: { plat: Plat; qte: number; options: string; sousTotal: number; sousTotalResto: number }[];
  sousTotal: number;
  sousTotalResto: number;
  /** Livraison payée par le client : 0 si elle est gratuite. */
  frais: number;
  /** Prix de la livraison offerte par le livreur (0 si elle n'est pas gratuite). */
  fraisOffert: number;
  /** Supplément pluie / nuit payé par le client, pour le livreur (0 = aucun). */
  supplement: number;
  supplementLibelle: string;
  /** Frais de service (en plus de la livraison, pour le livreur). */
  fraisService: number;
  /** Commission du livreur sur les restos (prise sur la part du resto). */
  commission: number;
  /** Remise de la promo appliquée (déjà déduite du total). `partResto` / `partLivreur` : qui la paie. */
  remise: number;
  promo: { nom: string; /** Texte des messages : « Coupon CODE » pour un coupon, « Promo « nom » » sinon (jointes par « + »). */ libelle: string; code?: string; partResto: number; partLivreur: number } | null;
  /** Somme due au restaurant : prix du resto − commission − part de la promo payée par le resto. */
  dueResto: number;
  /** Pourboire du client, pour le livreur. */
  pourboire: number;
  km: number;
  total: number;
  position: Point & { precision?: number };
  client: { nom: string; telephone: string; adresse: string; note?: string; email?: string };
};

/** Numéro tunisien → `216XXXXXXXX`, sinon null. */
export function normaliserTelephone(raw: string): string | null {
  let d = raw.replace(/\D/g, '');
  if (d.startsWith('00')) d = d.slice(2);
  if (d.length === 8) d = `216${d}`;
  return /^216\d{8}$/.test(d) ? d : null;
}

// Money in integer millimes to avoid float drift.
const mil = (dt: number) => Math.round(dt * 1000);

const versChoix = (c: Record<string, number[]> | undefined): Choix =>
  Object.fromEntries(Object.entries(c ?? {}).map(([k, v]) => [Number(k), v]));

/** Le plat aux prix du resto (avant majoration du livreur). */
const prixDuResto = (p: Plat): Plat => ({
  ...p,
  prix: p.prixResto ?? p.prix,
  groupes: p.groupes.map((g) => ({ ...g, options: g.options.map((o) => ({ ...o, prix: o.prixResto ?? o.prix })) })),
});

export function calculerCommande(
  livreur: Livreur,
  resto: RestoIndex,
  menu: Menu,
  input: CommandeInput,
  maintenant: Date = new Date(),
  regles: { commandeMin?: number | null; supplement?: Supplement | null } = {},
): CommandeCalculee | { erreur: string } {
  if (!estOuvert(resto.horaires, maintenant)) return { erreur: `${resto.nom} est fermé. ${libelleHoraire(resto.horaires, maintenant)}.` };
  const livraison = calculerLivraison(livreur.livraison, resto.position, input.position);
  if ('erreur' in livraison) return livraison;
  const telephone = normaliserTelephone(input.client.telephone);
  if (!telephone) return { erreur: 'Numéro de téléphone invalide (8 chiffres).' };

  const lignes: CommandeCalculee['lignes'] = [];
  let sousTotalMil = 0;
  let sousTotalRestoMil = 0;
  let commissionTotalMil = 0;
  for (const l of input.lignes) {
    const plat = menu.plats.find((p) => p.id === l.platId);
    if (!plat) return { erreur: 'Un plat du panier n’est plus disponible.' };
    const choix = versChoix(l.choix);
    const invalide = validerChoix(plat, choix);
    if (invalide) return { erreur: `${plat.nom} : ${invalide}` };
    const ligneMil = mil(prixUnitaire(plat, choix)) * l.qte;
    const ligneRestoMil = mil(prixUnitaire(prixDuResto(plat), choix)) * l.qte;
    sousTotalMil += ligneMil;
    sousTotalRestoMil += ligneRestoMil;
    commissionTotalMil += commissionMil(ligneRestoMil, pourcentCommission(livreur.commission, resto.slug));
    lignes.push({ plat, qte: l.qte, options: resumeChoix(plat, choix), sousTotal: ligneMil / 1000, sousTotalResto: ligneRestoMil / 1000 });
  }
  if (regles.commandeMin && sousTotalMil < mil(regles.commandeMin)) return { erreur: `Commande minimum : ${formaterPrix(regles.commandeMin)} de plats (votre panier : ${formaterPrix(sousTotalMil / 1000)}).` };
  // Promo (une seule, la plus avantageuse) : remise sur les plats ; financée par le livreur, le resto ou les deux.
  const parPlatMil: Record<number, number> = {};
  for (const l of lignes) parPlatMil[l.plat.id] = (parPlatMil[l.plat.id] ?? 0) + mil(l.sousTotal);
  // Un code valide passe avant les promos automatiques ; un code refusé bloque la commande (le client ne paierait pas
  // le prix qu'il croit).
  const code = input.code?.toUpperCase();
  const coupons = (livreur.promos ?? []).filter((p) => p.code && p.code === code);
  const duCoupon = code ? meilleurePromo(coupons, resto.slug, sousTotalMil, parPlatMil) : null;
  if (code && !duCoupon) return { erreur: 'Ce code promo n’est pas valable pour cette commande (code inconnu, resto ou panier minimum).' };
  const appliquees = promosAppliquees(duCoupon?.promo ?? null, (livreur.promos ?? []).filter((p) => !p.code), resto.slug, sousTotalMil, parPlatMil);
  const remiseMil = appliquees.reduce((n, a) => n + a.remiseMil, 0);
  // Chaque remise a son financeur ; la part du resto ne dépasse jamais ce qui lui reste (prix − commission − parts déjà prises).
  const partage = { restoMil: 0, livreurMil: 0 };
  for (const a of appliquees) {
    const r = repartirRemise(a.remiseMil, partRestoPourcent(a.promo), sousTotalRestoMil - commissionTotalMil - partage.restoMil);
    partage.restoMil += r.restoMil;
    partage.livreurMil += r.livreurMil;
  }
  // Livraison gratuite (offerte par le livreur) : le client ne la paie pas, elle ne rentre pas dans le gain.
  // « Dès 12 DT » se lit sur le panier tel que le client l'a composé : une promo ne lui retire pas la livraison gratuite.
  const offerte = livraisonOfferte(livreur.livraisonGratuite, sousTotalMil);
  const fraisMil = offerte ? 0 : mil(livraison.frais);
  // Supplément pluie / nuit : sur la livraison, donc offert aussi quand la livraison est gratuite.
  const sup = offerte ? null : supplementEnCours(regles.supplement, maintenant);
  const supplementMil = sup ? mil(sup.montant) : 0;
  // Frais de service sur les plats après remise (comme Hamma).
  const serviceMil = mil(calculerFraisService(livreur.fraisService, (sousTotalMil - remiseMil) / 1000));
  const pourboireMil = mil(input.pourboire ?? 0);
  return {
    resto,
    lignes,
    sousTotal: sousTotalMil / 1000,
    sousTotalResto: sousTotalRestoMil / 1000,
    frais: fraisMil / 1000,
    fraisOffert: offerte ? livraison.frais : 0,
    supplement: supplementMil / 1000,
    supplementLibelle: sup?.libelle ?? '',
    fraisService: serviceMil / 1000,
    commission: commissionTotalMil / 1000,
    remise: remiseMil / 1000,
    promo: appliquees.length ? { nom: appliquees.map((a) => a.promo.nom).join(' + '), libelle: appliquees.map((a) => (a.promo.code ? `Coupon ${a.promo.code}` : `Promo « ${a.promo.nom} »`)).join(' + '), code: duCoupon?.promo.code, partResto: partage.restoMil / 1000, partLivreur: partage.livreurMil / 1000 } : null,
    dueResto: (sousTotalRestoMil - commissionTotalMil - partage.restoMil) / 1000,
    pourboire: pourboireMil / 1000,
    km: livraison.km,
    total: (sousTotalMil - remiseMil + fraisMil + supplementMil + serviceMil + pourboireMil) / 1000,
    position: input.position,
    client: { ...input.client, telephone, note: input.client.note || undefined },
  };
}

export function formaterPrix(n: number): string {
  return `${n.toFixed(3).replace('.', ',')} DT`;
}

/** Majoration du livreur sur cette commande (prix client − prix du resto). */
export const marge = (c: Pick<CommandeCalculee, 'sousTotal' | 'sousTotalResto'>) => Math.round((c.sousTotal - c.sousTotalResto) * 1000) / 1000;

/** Gain du livreur : livraison + majoration + frais de service + commission + pourboire − sa part de la promo. */
export const gain = (c: Pick<CommandeCalculee, 'frais' | 'supplement' | 'fraisService' | 'pourboire' | 'sousTotal' | 'sousTotalResto' | 'commission' | 'promo'>) =>
  Math.round((c.frais + c.supplement + c.fraisService + c.pourboire + c.commission + marge(c) - (c.promo?.partLivreur ?? 0)) * 1000) / 1000;

export const afficherTel = (t: string) => `+216 ${t.slice(3, 5)} ${t.slice(5, 8)} ${t.slice(8)}`;

/** Fiabilité du point client, pour le livreur : GPS (précision) ou point posé sur la carte. */
export const originePosition = (p: { precision?: number }) => (p.precision === undefined ? 'point choisi sur la carte' : `GPS du téléphone, ± ${p.precision} m`);

export const lienMaps = (p: Point) => `https://www.google.com/maps?q=${p.lat.toFixed(6)},${p.lng.toFixed(6)}`;

/** Texte brut de l'email au livreur (avec sa marge : jamais dans le message WhatsApp, que le client voit). */
export function messageCommande(c: CommandeCalculee, livreur: Livreur): string {
  return [
    `NOUVELLE COMMANDE — ${livreur.nom}`,
    '',
    `Restaurant : ${c.resto.nom}`,
    `Adresse : ${c.resto.adresse}`,
    `Tél : ${c.resto.telephone}`,
    `Carte : ${lienMaps(c.resto.position)}`,
    '',
    ...c.lignes.flatMap((l) => [
      `${l.qte} × ${l.plat.nom} = ${formaterPrix(l.sousTotal)}${l.sousTotal !== l.sousTotalResto ? ` (resto : ${formaterPrix(l.sousTotalResto)})` : ''}`,
      ...(l.options ? [`   + ${l.options}`] : []),
    ]),
    '',
    `Sous-total : ${formaterPrix(c.sousTotal)}`,
    ...(c.sousTotal !== c.sousTotalResto
      ? [`   dont prix du resto : ${formaterPrix(c.sousTotalResto)}`, `   dont votre majoration : ${formaterPrix(marge(c))}`]
      : []),
    ...(c.promo ? [`${c.promo.libelle} : −${formaterPrix(c.remise)}`] : []),
    c.fraisOffert ? `Livraison : OFFERTE (${formaterPrix(c.fraisOffert)} à votre charge) (${String(c.km).replace('.', ',')} km)` : `Livraison : ${formaterPrix(c.frais)} (${String(c.km).replace('.', ',')} km)`,
    ...(c.supplement ? [`Supplément ${c.supplementLibelle} : ${formaterPrix(c.supplement)}`] : []),
    ...(c.fraisService ? [`Frais de service : ${formaterPrix(c.fraisService)}`] : []),
    ...(c.pourboire ? [`Pourboire : ${formaterPrix(c.pourboire)}`] : []),
    `TOTAL : ${formaterPrix(c.total)} (paiement à la livraison)`,
    ...(c.sousTotal !== c.sousTotalResto || c.fraisService || c.pourboire || c.commission || c.promo || c.fraisOffert || c.supplement
      ? [
          '',
          `À ENCAISSER du client : ${formaterPrix(c.total)}`,
          `SOMME DUE AU RESTAURANT : ${formaterPrix(c.dueResto)} (le montant final à donner au resto)`,
          `VOTRE GAIN : ${formaterPrix(gain(c))}`,
          `   livraison : ${c.fraisOffert ? `offerte au client (0, soit ${formaterPrix(c.fraisOffert)} que vous n'encaissez pas)` : formaterPrix(c.frais)}`,
          ...(marge(c) ? [`   majoration : ${formaterPrix(marge(c))}`] : []),
          ...(c.supplement ? [`   supplément ${c.supplementLibelle} : ${formaterPrix(c.supplement)}`] : []),
          ...(c.fraisService ? [`   frais de service : ${formaterPrix(c.fraisService)}`] : []),
          ...(c.commission ? [`   commission sur le resto : ${formaterPrix(c.commission)}`] : []),
          ...(c.pourboire ? [`   pourboire : ${formaterPrix(c.pourboire)}`] : []),
          ...(c.promo?.partLivreur ? [`   promo payée par vous : −${formaterPrix(c.promo.partLivreur)}`] : []),
          ...(c.promo?.partResto ? [`   (promo payée par le resto : ${formaterPrix(c.promo.partResto)}, déjà retirée de la somme due)`] : []),
        ]
      : []),
    '',
    `Client : ${c.client.nom}`,
    `Tél : ${afficherTel(c.client.telephone)}`,
    `Adresse : ${c.client.adresse}`,
    `Position (${originePosition(c.position)}) : ${lienMaps(c.position)}`,
    ...(c.client.note ? [`Note : ${c.client.note}`] : []),
  ].join('\n');
}

/** Message WhatsApp du livreur : mise en forme WhatsApp (*gras*, _italique_), emojis, lien vers l'image du bon. */
export function messageWhatsApp(c: CommandeCalculee, livreur: Livreur, ref: string, lienBon: string | null): string {
  const km = String(c.km).replace('.', ',');
  return [
    `🛵 *NOUVELLE COMMANDE N° ${ref}*`,
    `_via ${livreur.nom}_`,
    '',
    `🏪 *${c.resto.nom}*`,
    `📍 ${c.resto.adresse}`,
    `🗺️ ${lienMaps(c.resto.position)}`,
    `📞 ${c.resto.telephone}`,
    '',
    '🧾 *ARTICLES*',
    ...c.lignes.flatMap((l) => [`▪️ ${l.qte}× ${l.plat.nom} — ${formaterPrix(l.sousTotal)}`, ...(l.options ? [`   _+ ${l.options}_`] : [])]),
    '',
    `Sous-total : ${formaterPrix(c.sousTotal)}`,
    ...(c.promo ? [`${c.promo.libelle} : −${formaterPrix(c.remise)}`] : []),
    `Livraison (${km} km) : ${c.fraisOffert ? 'offerte 🎉' : formaterPrix(c.frais)}`,
    ...(c.supplement ? [`Supplément ${c.supplementLibelle} : ${formaterPrix(c.supplement)}`] : []),
    ...(c.fraisService ? [`Frais de service : ${formaterPrix(c.fraisService)}`] : []),
    ...(c.pourboire ? [`Pourboire : ${formaterPrix(c.pourboire)}`] : []),
    `💵 *TOTAL : ${formaterPrix(c.total)}*`,
    '_Paiement en espèces à la livraison_',
    '',
    `👤 *${c.client.nom}*`,
    `📞 ${afficherTel(c.client.telephone)}`,
    `🏠 ${c.client.adresse}`,
    `🗺️ ${lienMaps(c.position)}`,
    ...(c.client.note ? [`📝 ${c.client.note}`] : []),
    ...(lienBon ? ['', '🧾 Bon à transférer au resto :', lienBon] : []),
  ].join('\n');
}
