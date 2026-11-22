// Version HTML de l'email de commande (le texte brut reste envoyé à côté pour les clients mail simples).
// Tableaux + styles inline : seul format rendu correctement par Gmail / Outlook.
import { afficherTel, formaterPrix, gain, lienMaps, marge, originePosition, type CommandeCalculee } from './commande';
import type { Livreur } from './livreur';
import { TAILLES, type ColisCalcule } from './colis';
import { imageUrl } from './media';

const echapper = (s: string) => s.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]!);

const ENCRE = '#16213f';
const GRIS = '#5b6478';
const FOND = '#eef3fb';
const POLICE = "font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

function bloc(titre: string, icone: string, contenu: string): string {
  return `<tr><td style="padding:0 24px 16px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${FOND};border-radius:14px">
<tr><td style="padding:14px 16px;${POLICE};color:${ENCRE};font-size:14px;line-height:1.5">
<div style="font-weight:800;font-size:13px;letter-spacing:.06em;text-transform:uppercase;color:${GRIS};margin-bottom:6px">${icone}&nbsp; ${titre}</div>${contenu}</td></tr></table></td></tr>`;
}

/** `media` : base absolue des images (Gmail ne charge pas les chemins relatifs). `lienBon` : image du bon pour le resto. */
export function htmlCommande(c: CommandeCalculee, livreur: Livreur, ref: string, media: string, lienBon: string | null = null): string {
  const couleur = livreur.couleur;
  const lien = (href: string, texte: string) => `<a href="${echapper(href)}" style="color:${couleur};font-weight:700;text-decoration:none">${texte}</a>`;

  const lignes = c.lignes
    .map((l) => {
      const img = imageUrl('product', l.plat.image, 'thumb', media);
      const vignette = img
        ? `<img src="${echapper(img)}" width="56" height="56" alt="" style="display:block;width:56px;height:56px;border-radius:12px;object-fit:cover;background:${FOND}">`
        : `<div style="width:56px;height:56px;border-radius:12px;background:${FOND};text-align:center;line-height:56px;font-size:24px">🍽️</div>`;
      return `<tr>
<td width="56" style="padding:10px 0;vertical-align:top">${vignette}</td>
<td style="padding:10px 12px;vertical-align:top;${POLICE};color:${ENCRE}">
<div style="font-size:15px;font-weight:800"><span style="display:inline-block;background:${couleur};color:#fff;border-radius:6px;padding:1px 7px;margin-right:6px">${l.qte}×</span>${echapper(l.plat.nom)}</div>
${l.options ? `<div style="font-size:13px;color:${GRIS};margin-top:4px">+ ${echapper(l.options)}</div>` : ''}
${l.sousTotal !== l.sousTotalResto ? `<div style="font-size:12px;color:${GRIS};margin-top:4px">Prix resto ${formaterPrix(l.sousTotalResto)} · votre majoration +${formaterPrix(Math.round((l.sousTotal - l.sousTotalResto) * 1000) / 1000)}</div>` : ''}
</td>
<td align="right" style="padding:10px 0;vertical-align:top;white-space:nowrap;${POLICE};font-size:15px;font-weight:800;color:${ENCRE}">${formaterPrix(l.sousTotal)}</td>
</tr>`;
    })
    .join('<tr><td colspan="3" style="border-top:1px dashed #dfe5f0;font-size:0;line-height:0">&nbsp;</td></tr>');

  const ligneTotal = (lib: string, val: string, fort = false) =>
    `<tr><td style="${POLICE};font-size:${fort ? 17 : 14}px;color:${fort ? ENCRE : GRIS};font-weight:${fort ? 800 : 500};padding:3px 0">${lib}</td>
<td align="right" style="${POLICE};font-size:${fort ? 19 : 14}px;color:${fort ? couleur : ENCRE};font-weight:800;padding:3px 0;white-space:nowrap">${val}</td></tr>`;

  const resto = c.resto;
  const client = c.client;
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Commande N° ${ref}</title></head>
<body style="margin:0;padding:0;background:${FOND}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${FOND}"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#fff;border-radius:20px;overflow:hidden">
<tr><td style="background:${couleur};padding:22px 24px;${POLICE};color:#fff">
<div style="font-size:13px;font-weight:800;letter-spacing:.08em;opacity:.9">🛵 NOUVELLE COMMANDE · ${echapper(livreur.nom)}</div>
<div style="font-size:26px;font-weight:800;margin-top:6px">N° ${ref}</div>
<div style="font-size:15px;margin-top:2px;opacity:.95">${echapper(resto.nom)} · ${formaterPrix(c.total)} à encaisser</div>
</td></tr>
<tr><td style="height:16px;font-size:0">&nbsp;</td></tr>
<tr><td style="padding:0 24px 16px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td colspan="2" style="background:${ENCRE};border-radius:16px;padding:14px 16px;${POLICE};color:#fff">
<div style="font-size:13px;font-weight:700;opacity:.8">À encaisser auprès du client</div>
<div style="font-size:30px;font-weight:800;margin-top:2px">${formaterPrix(c.total)}</div>
<div style="font-size:12px;opacity:.8">Plats ${formaterPrix(c.sousTotal)}${c.promo ? ` − promo ${formaterPrix(c.remise)}` : ''} + livraison ${c.fraisOffert ? 'offerte' : formaterPrix(c.frais)}${c.supplement ? ` + supplément ${formaterPrix(c.supplement)}` : ''}${c.fraisService ? ` + frais de service ${formaterPrix(c.fraisService)}` : ''}${c.pourboire ? ` + pourboire ${formaterPrix(c.pourboire)}` : ''}</div></td></tr>
<tr><td colspan="2" style="height:8px;font-size:0">&nbsp;</td></tr>
<tr><td width="50%" valign="top" style="background:${FOND};border-radius:14px;padding:12px 14px;${POLICE};color:${ENCRE}">
<div style="font-size:12px;font-weight:700;color:${GRIS}">Somme due au restaurant</div>
<div style="font-size:20px;font-weight:800">${formaterPrix(c.dueResto)}</div>
<div style="font-size:12px;color:${GRIS}">le montant final à donner au resto${c.commission || c.promo?.partResto ? ` (prix ${formaterPrix(c.sousTotalResto)}${c.commission ? ` − commission ${formaterPrix(c.commission)}` : ''}${c.promo?.partResto ? ` − promo ${formaterPrix(c.promo.partResto)}` : ''})` : ''}</div></td>
<td width="50%" valign="top" style="background:#e5f5ee;border-radius:14px;padding:12px 14px;${POLICE};color:#0b5a40">
<div style="font-size:12px;font-weight:700">Votre gain</div>
<div style="font-size:20px;font-weight:800">${formaterPrix(gain(c))}</div>
<div style="font-size:12px">${c.fraisOffert ? `livraison offerte (${formaterPrix(c.fraisOffert)} à votre charge)` : `livraison ${formaterPrix(c.frais)}`}</div>${marge(c) > 0 ? `<div style="font-size:12px">majoration ${formaterPrix(marge(c))}</div>` : ''}${c.supplement ? `<div style="font-size:12px">supplément ${echapper(c.supplementLibelle)} ${formaterPrix(c.supplement)}</div>` : ''}${c.fraisService ? `<div style="font-size:12px">frais de service ${formaterPrix(c.fraisService)}</div>` : ''}${c.commission ? `<div style="font-size:12px">commission ${formaterPrix(c.commission)}</div>` : ''}${c.pourboire ? `<div style="font-size:12px">pourboire ${formaterPrix(c.pourboire)}</div>` : ''}${c.promo?.partLivreur ? `<div style="font-size:12px">promo payée par vous −${formaterPrix(c.promo.partLivreur)}</div>` : ''}</td></tr></table></td></tr>
${bloc('Restaurant', '🏪', `<div style="font-weight:800;font-size:16px">${echapper(resto.nom)}</div>
<div>📍 ${echapper(resto.adresse)} · ${lien(lienMaps(resto.position), 'Itinéraire')}</div>
<div>📞 ${lien(`tel:${resto.telephone.replace(/\s/g, '')}`, echapper(resto.telephone))}</div>`)}
<tr><td style="padding:0 24px 8px"><div style="${POLICE};font-weight:800;font-size:13px;letter-spacing:.06em;text-transform:uppercase;color:${GRIS}">🧾&nbsp; Articles</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${lignes}</table></td></tr>
<tr><td style="padding:4px 24px 16px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:2px solid ${FOND};padding-top:8px">
${ligneTotal('Sous-total plats', formaterPrix(c.sousTotal))}
${marge(c) > 0 ? `${ligneTotal('&nbsp;&nbsp;dont prix du resto', formaterPrix(c.sousTotalResto))}${ligneTotal('&nbsp;&nbsp;dont votre majoration', `+${formaterPrix(marge(c))}`)}` : ''}
${c.promo ? ligneTotal(echapper(c.promo.libelle), `−${formaterPrix(c.remise)}`) : ''}
${ligneTotal(`Livraison (${String(c.km).replace('.', ',')} km)`, c.fraisOffert ? `Offerte (${formaterPrix(c.fraisOffert)})` : formaterPrix(c.frais))}
${c.supplement ? ligneTotal(`Supplément ${echapper(c.supplementLibelle)}`, formaterPrix(c.supplement)) : ''}
${c.fraisService ? ligneTotal('Frais de service', formaterPrix(c.fraisService)) : ''}
${c.pourboire ? ligneTotal('Pourboire', formaterPrix(c.pourboire)) : ''}
${ligneTotal('Total à encaisser', formaterPrix(c.total), true)}
</table><div style="${POLICE};font-size:12px;color:${GRIS};margin-top:4px">💵 Paiement en espèces à la livraison</div></td></tr>
${bloc('Client', '👤', `<div style="font-weight:800;font-size:16px">${echapper(client.nom)}</div>
<div>📞 ${lien(`tel:+${client.telephone}`, afficherTel(client.telephone))}</div>
<div>🏠 ${echapper(client.adresse)}</div>
<div>📍 ${lien(lienMaps(c.position), 'Voir la position sur Google Maps')} <span style="color:${GRIS};font-size:12px">(${originePosition(c.position)})</span></div>
${client.note ? `<div>📝 ${echapper(client.note)}</div>` : ''}`)}
${lienBon ? `<tr><td style="padding:4px 24px 22px;${POLICE};font-size:12px;color:${GRIS}">🧾 Bon à transférer au restaurant : ${lien(lienBon, 'ouvrir l’image du bon')}</td></tr>` : ''}
</table></td></tr></table></body></html>`;
}

/** Récapitulatif envoyé au client (email facultatif) : articles, détail et montant à payer. Prix client uniquement. */
export function htmlClientCommande(c: CommandeCalculee, livreur: Livreur, ref: string): string {
  const couleur = livreur.couleur;
  const ligne = (lib: string, val: string, fort = false) =>
    `<tr><td style="${POLICE};font-size:${fort ? 17 : 14}px;color:${fort ? ENCRE : GRIS};font-weight:${fort ? 800 : 500};padding:3px 0">${lib}</td><td align="right" style="${POLICE};font-size:${fort ? 19 : 14}px;color:${fort ? couleur : ENCRE};font-weight:800;padding:3px 0;white-space:nowrap">${val}</td></tr>`;
  const articles = c.lignes
    .map((l) => ligne(`${l.qte}× ${echapper(l.plat.nom)}${l.options ? `<div style="font-size:12px;font-weight:400">+ ${echapper(l.options)}</div>` : ''}`, formaterPrix(l.sousTotal)))
    .join('');
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Votre commande N° ${ref}</title></head>
<body style="margin:0;padding:0;background:${FOND}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#fff;border-radius:20px;overflow:hidden">
<tr><td style="background:${couleur};padding:22px 24px;${POLICE};color:#fff">
<div style="font-size:13px;font-weight:800;letter-spacing:.08em;opacity:.9">VOTRE COMMANDE · ${echapper(livreur.nom)}</div>
<div style="font-size:26px;font-weight:800;margin-top:6px">N° ${ref}</div>
<div style="font-size:15px;margin-top:2px;opacity:.95">${echapper(c.resto.nom)}</div></td></tr>
<tr><td style="padding:20px 24px 8px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${ENCRE};border-radius:16px"><tr><td style="padding:14px 16px;${POLICE};color:#fff">
<div style="font-size:13px;font-weight:700;opacity:.8">Montant à payer</div>
<div style="font-size:30px;font-weight:800;margin-top:2px">${formaterPrix(c.total)}</div>
<div style="font-size:12px;opacity:.8">💵 En espèces à la livraison</div></td></tr></table></td></tr>
<tr><td style="padding:8px 24px 16px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${articles}
${c.promo ? ligne(echapper(c.promo.libelle), `−${formaterPrix(c.remise)}`) : ''}
${ligne(`Livraison (${String(c.km).replace('.', ',')} km)`, c.fraisOffert ? 'Offerte' : formaterPrix(c.frais))}
${c.supplement ? ligne(`Supplément ${echapper(c.supplementLibelle)}`, formaterPrix(c.supplement)) : ''}
${c.fraisService ? ligne('Frais de service', formaterPrix(c.fraisService)) : ''}
${c.pourboire ? ligne('Pourboire', formaterPrix(c.pourboire)) : ''}
${ligne('Total à payer', formaterPrix(c.total), true)}</table></td></tr>
<tr><td style="padding:0 24px 22px;${POLICE};font-size:13px;color:${GRIS};line-height:1.5">🏠 ${echapper(c.client.adresse)}<br>📞 ${afficherTel(c.client.telephone)}${c.client.note ? `<br>📝 ${echapper(c.client.note)}` : ''}<br><br>Le livreur vous contactera si besoin. Merci pour votre commande !</td></tr>
</table></td></tr></table></body></html>`;
}

/** Version texte du récapitulatif client. */
export function texteClientCommande(c: CommandeCalculee, livreur: Livreur, ref: string): string {
  return [
    `Votre commande N° ${ref} — ${c.resto.nom} (${livreur.nom})`,
    '',
    ...c.lignes.map((l) => `${l.qte}× ${l.plat.nom}${l.options ? ` (${l.options})` : ''} : ${formaterPrix(l.sousTotal)}`),
    `Livraison : ${c.fraisOffert ? 'offerte' : formaterPrix(c.frais)}`,
    '',
    `MONTANT À PAYER : ${formaterPrix(c.total)} (espèces à la livraison)`,
    '',
    `Adresse : ${c.client.adresse}`,
  ].join('\n');
}

/** Email au livreur pour une demande de colis : en premier, de quoi appeler le client. */
export function htmlColis(c: ColisCalcule, livreur: Livreur, ref: string): string {
  const couleur = livreur.couleur;
  const lien = (href: string, texte: string) => `<a href="${echapper(href)}" style="color:${couleur};font-weight:700;text-decoration:none">${texte}</a>`;
  const bouton = (href: string, texte: string, fond: string, encre: string) =>
    `<a href="${echapper(href)}" style="display:inline-block;background:${fond};color:${encre};font-weight:800;font-size:15px;text-decoration:none;border-radius:999px;padding:12px 22px;margin:4px 8px 0 0">${texte}</a>`;
  const tel = c.client.telephone;
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Colis N° ${ref}</title></head>
<body style="margin:0;padding:0;background:${FOND}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${FOND}"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#fff;border-radius:20px;overflow:hidden">
<tr><td style="background:${couleur};padding:22px 24px;${POLICE};color:#fff">
<div style="font-size:13px;font-weight:800;letter-spacing:.08em;opacity:.9">📦 NOUVELLE DEMANDE DE COLIS · ${echapper(livreur.nom)}</div>
<div style="font-size:26px;font-weight:800;margin-top:6px">N° ${ref}</div>
<div style="font-size:15px;margin-top:2px;opacity:.95">${echapper(TAILLES[c.taille])} · ${c.heure ? `à ${c.heure}` : 'dès que possible'} · ≈ ${formaterPrix(c.frais)} (${String(c.km).replace('.', ',')} km)</div>
</td></tr>
<tr><td style="padding:20px 24px 16px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fff6dc;border-radius:14px">
<tr><td style="padding:16px;${POLICE};color:${ENCRE}">
<div style="font-weight:800;font-size:13px;letter-spacing:.06em;color:#6b4a00">À FAIRE : APPELER LE CLIENT</div>
<div style="font-weight:800;font-size:18px;margin:6px 0 8px">${echapper(c.client.nom)} · ${afficherTel(tel)}</div>
${bouton(`tel:+${tel}`, '📞 Appeler', ENCRE, '#ffffff')}${bouton(`https://wa.me/${tel}`, 'WhatsApp', '#25d366', '#0b3d1f')}
</td></tr></table></td></tr>
${bloc('Ramassage', '🟦', `<div style="font-weight:800;font-size:16px">${echapper(c.depart.adresse)}</div><div>${lien(lienMaps(c.depart.position), 'Voir sur Google Maps')}</div>`)}
${bloc('Livraison', '⬛', `<div style="font-weight:800;font-size:16px">${echapper(c.arrivee.adresse)}</div>
<div>Destinataire : ${c.destinataire.nom ? `<strong>${echapper(c.destinataire.nom)}</strong> · ` : ''}${lien(`tel:+${c.destinataire.telephone}`, afficherTel(c.destinataire.telephone))}</div>
<div>${lien(lienMaps(c.arrivee.position), 'Voir sur Google Maps')}</div>`)}
${bloc('Colis', '📦', `<div>Taille : <strong>${echapper(TAILLES[c.taille])}</strong></div><div>Contenu : ${echapper(c.contenu)}</div>
<div>Quand : ${c.heure ? `à ${c.heure}` : 'dès que possible'}</div>${c.note ? `<div>📝 ${echapper(c.note)}</div>` : ''}`)}
<tr><td style="padding:4px 24px 22px;${POLICE};font-size:12px;color:${GRIS}">Prix estimé avec votre tarif colis (${String(c.km).replace('.', ',')} km${c.supplement ? `, dont ${formaterPrix(c.supplement)} de suppléments (${[c.supplements.taille ? 'taille' : '', c.supplements.urgent ? 'urgent' : '', c.supplements.nuit ? 'nuit' : ''].filter(Boolean).join(', ')})` : ''}) : <strong>${formaterPrix(c.frais)}</strong>. Rien n’est confirmé au client : appelez-le pour valider le prix et l’heure.</td></tr>
</table></td></tr></table></body></html>`;
}
