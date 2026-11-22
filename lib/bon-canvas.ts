// Dessine le bon de commande (PNG) dans le navigateur du client, avec l'API Canvas : aucune librairie,
// aucun calcul côté serveur (la Function gratuite a 10 ms de CPU). Les données viennent de /api/commande.
import type { DonneesBon } from './bon';

const ENCRE = '#16213f';
const GRIS = '#5b6478';
const FOND = '#eef3fb';
const LARGEUR = 800;
const VIGNETTE = 104;
const X0 = 64; // marge intérieure gauche/droite
const H_NOM = 36;
const H_OPTION = 30;

/** Image chargée avec CORS (sinon le canvas est « sali » et ne s'exporte plus). null si absente ou bloquée. */
function chargerImage(src: string | null): Promise<HTMLImageElement | null> {
  if (!src) return Promise.resolve(null);
  return new Promise((ok) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    const fin = setTimeout(() => ok(null), 4000);
    img.onload = () => {
      clearTimeout(fin);
      ok(img);
    };
    img.onerror = () => {
      clearTimeout(fin);
      ok(null);
    };
    img.src = src;
  });
}

/** Coupe un texte en lignes qui tiennent dans `largeur`. Au-delà de `max` lignes, la dernière finit par « … ». */
export function couperLignes(mesurer: (t: string) => number, texte: string, largeur: number, max = 3): string[] {
  const lignes: string[] = [];
  let courante = '';
  for (const mot of texte.split(/\s+/).filter(Boolean)) {
    const essai = courante ? `${courante} ${mot}` : mot;
    if (!courante || mesurer(essai) <= largeur) courante = essai;
    else {
      lignes.push(courante);
      courante = mot;
    }
  }
  if (courante) lignes.push(courante);
  if (lignes.length > max) {
    lignes.length = max;
    lignes[max - 1] += '…';
  }
  return lignes;
}

function pastille(ctx: CanvasRenderingContext2D, x: number, y: number, l: number, h: number, r: number, couleur: string) {
  ctx.fillStyle = couleur;
  ctx.beginPath();
  ctx.roundRect(x, y, l, h, r);
  ctx.fill();
}

/** Dessine le bon et renvoie le PNG, ou null si le navigateur ne sait pas faire. */
export async function dessinerBon(d: DonneesBon): Promise<Blob | null> {
  const police = getComputedStyle(document.body).fontFamily || 'sans-serif';
  await document.fonts?.ready;
  const images = await Promise.all(d.lignes.map((l) => chargerImage(l.image)));

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx || !ctx.roundRect) return null;
  const font = (taille: number, poids = 800) => `${poids} ${taille}px ${police}`;
  const mesurer = (t: string) => ctx.measureText(t).width;

  // Mise en page des articles (avant de fixer la hauteur du canvas)
  const xTexte = X0 + VIGNETTE + 20;
  const largeurTexte = LARGEUR - X0 - 130 - xTexte; // 130 px réservés au prix
  const blocs = d.lignes.map((l) => {
    ctx.font = font(24);
    const lq = mesurer(`${l.qte}×`) + 24;
    ctx.font = font(29);
    const nom = couperLignes(mesurer, l.nom, largeurTexte - lq - 12, 2);
    ctx.font = font(22, 400);
    const options = l.options ? couperLignes(mesurer, `+ ${l.options}`, largeurTexte, 4) : [];
    const texte = nom.length * H_NOM + (options.length ? 8 + options.length * H_OPTION : 0);
    return { lq, nom, options, texte, hauteur: Math.max(VIGNETTE + 32, texte + 32) };
  });
  const EN_TETE = 250;
  const nbRangs = d.deductions.length ? d.deductions.length + 1 : 0; // « Montant des plats » + chaque retrait
  const RANG = 46;
  const PIED = 210 + nbRangs * RANG;
  const hauteur = 28 + EN_TETE + 12 + blocs.reduce((a, b) => a + b.hauteur, 0) + PIED + 28;
  canvas.width = LARGEUR;
  canvas.height = hauteur;
  ctx.textBaseline = 'middle';

  // Fond + carte blanche arrondie
  ctx.fillStyle = FOND;
  ctx.fillRect(0, 0, LARGEUR, hauteur);
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(28, 28, LARGEUR - 56, hauteur - 56, 32);
  ctx.clip();
  ctx.fillStyle = '#fff';
  ctx.fillRect(28, 28, LARGEUR - 56, hauteur - 56);

  // En-tête aux couleurs du livreur
  ctx.fillStyle = d.couleur;
  ctx.fillRect(28, 28, LARGEUR - 56, EN_TETE);
  ctx.fillStyle = '#fff';
  ctx.font = font(24);
  ctx.fillText('🧾  BON DE COMMANDE', X0, 86);
  ctx.font = font(26);
  const numero = `N° ${d.ref}`;
  const ln = mesurer(numero) + 40;
  pastille(ctx, LARGEUR - X0 - ln, 64, ln, 44, 22, '#fff');
  ctx.fillStyle = d.couleur;
  ctx.fillText(numero, LARGEUR - X0 - ln + 20, 87);
  ctx.fillStyle = '#fff';
  ctx.font = font(46);
  ctx.fillText(couperLignes(mesurer, d.resto, LARGEUR - 2 * X0, 1)[0], X0, 160);
  ctx.font = font(22, 700);
  let xp = X0;
  for (const t of [`🕒 ${d.date}`, `🛍️ ${d.nbArticles} article${d.nbArticles > 1 ? 's' : ''}`, `🛵 ${d.livreur}`]) {
    const l = mesurer(t) + 32;
    if (xp + l > LARGEUR - X0) break;
    pastille(ctx, xp, 208, l, 44, 22, 'rgba(255,255,255,0.18)');
    ctx.fillStyle = '#fff';
    ctx.fillText(t, xp + 16, 231);
    xp += l + 12;
  }

  // Articles
  let y = 28 + EN_TETE + 12;
  d.lignes.forEach((l, i) => {
    const b = blocs[i];
    // Vignette (recadrage carré centré) ou icône
    const yv = y + (b.hauteur - VIGNETTE) / 2;
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(X0, yv, VIGNETTE, VIGNETTE, 20);
    ctx.clip();
    ctx.fillStyle = FOND;
    ctx.fillRect(X0, yv, VIGNETTE, VIGNETTE);
    const img = images[i];
    if (img) {
      const c = Math.min(img.naturalWidth, img.naturalHeight);
      ctx.drawImage(img, (img.naturalWidth - c) / 2, (img.naturalHeight - c) / 2, c, c, X0, yv, VIGNETTE, VIGNETTE);
    } else {
      ctx.font = font(44, 400);
      ctx.textAlign = 'center';
      ctx.fillText('🍽️', X0 + VIGNETTE / 2, yv + VIGNETTE / 2);
      ctx.textAlign = 'left';
    }
    ctx.restore();

    // Quantité + nom + options, centrés verticalement
    const yt = y + (b.hauteur - b.texte) / 2 + H_NOM / 2;
    ctx.font = font(24);
    pastille(ctx, xTexte, yt - 18, b.lq, 36, 12, d.couleur);
    ctx.fillStyle = '#fff';
    ctx.fillText(`${l.qte}×`, xTexte + 12, yt);
    ctx.fillStyle = ENCRE;
    ctx.font = font(29);
    b.nom.forEach((t, k) => ctx.fillText(t, xTexte + b.lq + 12, yt + k * H_NOM));
    ctx.fillStyle = GRIS;
    ctx.font = font(22, 400);
    const yo = yt + (b.nom.length - 1) * H_NOM + H_NOM / 2 + 8 + H_OPTION / 2;
    b.options.forEach((t, k) => ctx.fillText(t, xTexte, yo + k * H_OPTION));

    // Prix
    ctx.fillStyle = ENCRE;
    ctx.font = font(27);
    ctx.textAlign = 'right';
    ctx.fillText(l.prix, LARGEUR - X0, y + b.hauteur / 2);
    ctx.textAlign = 'left';

    y += b.hauteur;
    if (i < d.lignes.length - 1) {
      ctx.strokeStyle = '#e3e8f2';
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 6]);
      ctx.beginPath();
      ctx.moveTo(X0, y);
      ctx.lineTo(LARGEUR - X0, y);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  });

  // Montant des plats, retraits (commission, promo payée par le resto), puis ce que le resto reçoit + mention
  let yTotal = hauteur - 28 - PIED + 24;
  if (d.deductions.length) {
    const rangs = [{ libelle: 'Montant des plats', montant: d.sousTotal }, ...d.deductions];
    rangs.forEach((r, i) => {
      const yr = yTotal + i * RANG + RANG / 2;
      ctx.fillStyle = GRIS;
      ctx.font = font(24, 700);
      ctx.textAlign = 'left';
      ctx.fillText(r.libelle, X0 + 4, yr);
      ctx.fillStyle = i === 0 ? '#141a2b' : '#b42318';
      ctx.textAlign = 'right';
      ctx.fillText(r.montant, LARGEUR - X0 - 4, yr);
    });
    ctx.textAlign = 'left';
    yTotal += nbRangs * RANG;
  }
  pastille(ctx, X0, yTotal, LARGEUR - 2 * X0, 112, 22, FOND);
  ctx.fillStyle = GRIS;
  ctx.font = font(22, 700);
  ctx.fillText(d.deductions.length ? 'À payer au restaurant' : 'Montant des plats', X0 + 28, yTotal + 42);
  ctx.font = font(20, 400);
  ctx.fillText(`${d.nbArticles} article${d.nbArticles > 1 ? 's' : ''}`, X0 + 28, yTotal + 74);
  ctx.fillStyle = d.couleur;
  ctx.font = font(44);
  ctx.textAlign = 'right';
  ctx.fillText(d.deductions.length ? d.aPayer : d.sousTotal, LARGEUR - X0 - 28, yTotal + 58);
  ctx.textAlign = 'left';
  ctx.fillStyle = GRIS;
  ctx.font = font(20, 400);
  ctx.fillText(`ⓘ  Merci de préparer la commande N° ${d.ref}.`, X0, yTotal + 112 + 36);
  ctx.restore();

  return new Promise((ok) => canvas.toBlob((png) => ok(png), 'image/png'));
}

/** Dessine et envoie le bon (POST /api/bon/<id>). Ne lève jamais : sans bon, la commande reste valable. */
export async function envoyerBon(bon: { id: string; sig: string; donnees: DonneesBon }): Promise<boolean> {
  try {
    const png = await dessinerBon(bon.donnees);
    if (!png) return false;
    const res = await fetch(`/api/bon/${bon.id}?sig=${bon.sig}`, { method: 'POST', headers: { 'content-type': 'image/png' }, body: png });
    return res.ok;
  } catch {
    return false;
  }
}
