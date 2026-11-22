// Historique des commandes du livreur : une fiche JSON par commande dans le bucket BONS (`commandes/<whatsapp>/…`).
// Pur (sans R2 ni Node) : testé avec vitest, utilisé par lib/serveur.ts. Les fiches sont supprimées après 90 jours
// par une règle de cycle de vie du bucket (voir README).
import type { ColisCalcule } from './colis';
import type { CommandeCalculee } from './commande';
import { formaterPrix } from './commande';

export type Statut = 'nouvelle' | 'livree' | 'annulee';
export type Fiche = {
  id: string;
  type: 'repas' | 'colis';
  /** ISO. */
  creee: string;
  statut: Statut;
  /** ISO : date de livraison ou d'annulation. */
  fin?: string;
  ref: string;
  titre: string;
  lignes: string[];
  client: { nom: string; telephone: string };
  adresse: string;
  note?: string;
  total: number;
  /** Corps de l'email de commande (mêmes détails : gain, somme due au resto, articles, client, carte…). Absent sur une fiche sans détail. */
  html?: string;
};

export const ID_FICHE = /^\d{13}-[A-Z0-9]{6}$/;
export const cleFiche = (whatsapp: string, id: string) => `commandes/${whatsapp}/${id}.json`;
export const prefixeFiches = (whatsapp: string) => `commandes/${whatsapp}/`;
/** Plus la commande est récente, plus l'id est petit : `list` de R2 (ordre alphabétique) rend les récentes d'abord. */
export const idFiche = (ref: string, maintenant: Date) => `${String(9_999_999_999_999 - maintenant.getTime()).padStart(13, '0')}-${ref}`;

/** Contenu du `<body>` d'un email HTML (styles en ligne : s'affiche tel quel dans la page). */
export const corpsHtml = (doc: string) => /<body[^>]*>([\s\S]*)<\/body>/i.exec(doc)?.[1].trim();

export function ficheRepas(c: CommandeCalculee, ref: string, maintenant: Date, html?: string): Fiche {
  return {
    id: idFiche(ref, maintenant),
    type: 'repas',
    creee: maintenant.toISOString(),
    statut: 'nouvelle',
    ref,
    titre: c.resto.nom,
    lignes: c.lignes.map((l) => `${l.qte}× ${l.plat.nom}${l.options ? ` (${l.options})` : ''}`),
    client: { nom: c.client.nom, telephone: c.client.telephone },
    adresse: c.client.adresse,
    note: c.client.note || undefined,
    total: c.total,
    html: html && corpsHtml(html),
  };
}

export function ficheColis(c: ColisCalcule, ref: string, maintenant: Date, html?: string): Fiche {
  return {
    id: idFiche(ref, maintenant),
    type: 'colis',
    creee: maintenant.toISOString(),
    statut: 'nouvelle',
    ref,
    titre: `Colis ${c.taille}`,
    lignes: [c.contenu, `De : ${c.depart.adresse}`],
    client: { nom: c.client.nom, telephone: c.client.telephone },
    adresse: c.arrivee.adresse,
    note: c.note,
    total: c.frais,
    html: html && corpsHtml(html),
  };
}

/** Lit une fiche enregistrée ; null si le contenu n'est pas une fiche valide. */
export function lireFiche(brut: unknown): Fiche | null {
  const f = brut as Partial<Fiche> | null;
  if (!f || typeof f !== 'object' || typeof f.id !== 'string' || !ID_FICHE.test(f.id)) return null;
  if (!['nouvelle', 'livree', 'annulee'].includes(f.statut as string) || !Array.isArray(f.lignes) || !f.client) return null;
  return f as Fiche;
}

/** Applique un changement de statut : « nouvelle » ⇄ « livrée » / « annulée », la date de fin suit. */
export function changerStatut(f: Fiche, statut: Statut, maintenant: Date): Fiche {
  return { ...f, statut, fin: statut === 'nouvelle' ? undefined : maintenant.toISOString() };
}

const echapper = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
/** « samedi 21 novembre 2026 à 13:13 », heure de Tunis. */
const quand = new Intl.DateTimeFormat('fr-FR', { timeZone: 'Africa/Tunis', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });

function carte(f: Fiche): string {
  const tel = f.client.telephone;
  const boutons =
    f.statut === 'nouvelle'
      ? `<button data-id="${f.id}" data-s="livree" class="ok">✅ Livrée</button><button data-id="${f.id}" data-s="annulee" class="no">Annuler</button>`
      : `<button data-id="${f.id}" data-s="nouvelle" class="se">Remettre en cours</button>`;
  const etat = f.statut === 'livree' ? '✅ Livrée' : f.statut === 'annulee' ? '❌ Annulée' : '🕓 En cours';
  const detail = f.html
    ? `<div class="cm">${f.html}</div>`
    : `<ul>${f.lignes.map((l) => `<li>${echapper(l)}</li>`).join('')}</ul>
<p>👤 ${echapper(f.client.nom)} · <a href="tel:+${echapper(tel)}">${echapper(tel.slice(3))}</a><br>📍 ${echapper(f.adresse)}${f.note ? `<br>📝 ${echapper(f.note)}` : ''}</p>`;
  return `<details class="cc" data-id="${f.id}"${f.statut === 'nouvelle' ? ' open' : ''}><summary><div class="ct"><b>${echapper(f.titre)}</b><b>${formaterPrix(f.total)}</b></div>
<div class="cs">N° ${echapper(f.ref)} · ${etat}</div>
<div class="cs">📅 Reçue le ${quand.format(new Date(f.creee))}${f.fin ? `<br>${f.statut === 'livree' ? '✅ Livrée' : '❌ Annulée'} le ${quand.format(new Date(f.fin))}` : ''}</div></summary>
${detail}<div class="ca">${boutons}</div></details>`;
}

/**
 * Écran « Commandes » (en cours / historique), réutilisé par la page de config et par /api/commandes.
 * Tout est préfixé `.cmd` pour ne pas toucher au style de la page qui l'accueille. Les boutons envoient un POST à
 * /api/commandes puis rechargent la page.
 */
export function vueCommandes(fiches: Fiche[], couleur: string, cle: string): { css: string; html: string; js: string } {
  const enCours = fiches.filter((f) => f.statut === 'nouvelle');
  const histo = fiches.filter((f) => f.statut !== 'nouvelle');
  const liste = (l: Fiche[], vide: string) => (l.length ? l.map(carte).join('') : `<p class="vide">${vide}</p>`);
  const c = echapper(couleur);
  return {
    css: `.cmd{display:flex;flex-direction:column;gap:12px;color:#111}
.cmd .onglets{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.cmd .onglets button{height:48px;border:2px solid #ddd;border-radius:14px;background:#fff;font-size:16px;font-weight:800;color:#111}
.cmd[data-c=cours] .onglets .c,.cmd[data-c=histo] .onglets .h{background:${c};color:#fff;border-color:${c}}
.cmd[data-c=cours] .histo,.cmd[data-c=histo] .cours{display:none}
.cmd .cc{background:#fff;border-radius:20px;padding:16px;margin-bottom:12px}
.cmd summary{cursor:pointer;list-style:none}.cmd summary::-webkit-details-marker{display:none}
.cmd .ct{display:flex;justify-content:space-between;gap:8px;font-size:18px}.cmd .cs{color:#555;font-size:14px;margin-top:2px}
.cmd .cm{margin:12px -16px 0;overflow-x:auto}.cmd .cm table{max-width:100%}.cmd .cm img{max-width:100%}
.cmd ul{margin:8px 0;padding-left:20px}.cmd p{margin:8px 0}.cmd .vide{color:#666;text-align:center;padding:24px}
.cmd .ca{display:flex;gap:8px;margin-top:12px}.cmd .ca button{flex:1;height:52px;border:0;border-radius:14px;font-size:17px;font-weight:800;color:#fff}
.cmd .ok{background:#16a34a}.cmd .no{background:#dc2626}.cmd .se{background:#fff;color:#111!important;border:2px solid #ddd!important}`,
    html: `<div class="cmd" data-c="cours"><h1 style="font-size:28px;margin:0">🛵 Commandes</h1>
<div class="onglets"><button class="c" data-t="cours">En cours (${enCours.length})</button><button class="h" data-t="histo">Historique (${histo.length})</button></div>
<section class="cours">${liste(enCours, 'Aucune commande en cours.')}</section>
<section class="histo">${liste(histo, 'Pas encore de commande terminée. Gardé 90 jours.')}</section></div>`,
    js: `(function(){var K=${JSON.stringify(cle).replace(/</g, '\u003c')};
function W(){return document.querySelector('.cmd')}
if(!W())return;
document.addEventListener('click',function(e){var w=W(),t=e.target.closest&&e.target.closest('.onglets button,.ca button');if(!w||!t||!w.contains(t))return;
if(t.dataset.t){w.dataset.c=t.dataset.t;try{sessionStorage.cmdOnglet=t.dataset.t}catch(x){}return}
t.disabled=true;
fetch('/api/commandes?cle='+encodeURIComponent(K),{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({id:t.dataset.id,statut:t.dataset.s})})
.then(function(r){return r.json()}).then(function(r){if(r.ok)rafraichir();else{alert(r.erreur||'Échec');t.disabled=false}}).catch(function(){alert('Pas de connexion');t.disabled=false})});
try{if(sessionStorage.cmdOnglet)W().dataset.c=sessionStorage.cmdOnglet}catch(e){}
var enCours=false;
/* Recharge la liste sans recharger la page : nouvelle commande, retour sur l'appli, ou toutes les 30 s. */
function rafraichir(){if(enCours)return;enCours=true;
fetch(location.pathname+location.search,{cache:'no-store'}).then(function(r){return r.text()}).then(function(h){
var d=new DOMParser().parseFromString(h,'text/html'),n=d.querySelector('.cmd'),w=W();if(!n||!w)return;
var o={};w.querySelectorAll('details[data-id]').forEach(function(x){o[x.dataset.id]=x.open});
n.dataset.c=w.dataset.c;w.innerHTML=n.innerHTML;
w.querySelectorAll('details[data-id]').forEach(function(x){if(x.dataset.id in o)x.open=o[x.dataset.id]});
var b=document.querySelector('.alerte-cmd span'),nb=d.querySelector('.alerte-cmd span');if(b&&nb)b.textContent=nb.textContent;
}).catch(function(){}).then(function(){enCours=false})}
document.addEventListener('visibilitychange',function(){if(!document.hidden)rafraichir()});
setInterval(function(){if(!document.hidden)rafraichir()},30000);
if('serviceWorker' in navigator)navigator.serviceWorker.addEventListener('message',function(e){if(e.data&&e.data.type==='commande')rafraichir()});})();`,
  };
}

/** Page seule des commandes (/api/commandes). */
export function htmlCommandes(o: { nom: string; couleur: string; cle: string; fiches: Fiche[] }): string {
  const v = vueCommandes(o.fiches, o.couleur, o.cle);
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="robots" content="noindex"><link rel="apple-touch-icon" href="/icone-commandes.png"><link rel="icon" href="/icone-commandes.png"><meta name="apple-mobile-web-app-title" content="Commandes"><meta name="theme-color" content="${echapper(o.couleur)}"><title>${echapper(o.nom)} — commandes</title>
<style>body{margin:0;font:16px/1.45 system-ui,sans-serif;background:#f6f7fb;color:#111;padding:max(16px,env(safe-area-inset-top)) 16px 40px}main{max-width:520px;margin:0 auto}a{color:inherit}
${v.css}</style></head><body><main>${v.html}</main><script>${v.js}</script></body></html>`;
}
