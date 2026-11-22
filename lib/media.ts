// URLs des images (bucket R2 partagé par toutes les copies). Pur : utilisable au build, dans le navigateur et dans la Function.
export type TypeImage = 'restaurant' | 'product' | 'cuisine';

/** Base des images : MEDIA_BASE_URL au build, sinon le bucket R2 actuel. */
export const mediaBase = () =>
  ((typeof process !== 'undefined' && process.env?.MEDIA_BASE_URL) || 'https://media.hamma-delivery.com').replace(/\/$/, '');

/** URL webp d'une image du dump (même convention que le bucket R2 : `<type>/<taille>/<nom>.webp`). */
export function imageUrl(type: TypeImage, fichier: string | null, taille: 'thumb' | 'full', base = mediaBase()): string | null {
  if (!fichier) return null;
  return `${base.replace(/\/$/, '')}/${type}/${taille}/${fichier.replace(/\.[^.]*$/, '')}.webp`; // `[^.]*` : le dump a des noms finissant par un point nu (« xxx. »)
}

// ponytail: deux buckets se complètent (media.hamma-delivery.com et livreur.hamma-delivery.com/media), aucun n'est complet.
// À supprimer quand `npm run envoyer-images` aura rempli un seul bucket.
const HOTES = ['https://livreur.hamma-delivery.com/media', 'https://media.hamma-delivery.com'];
/** Même image sur l'autre hôte, ou null (URL inconnue). Utilisé par <Img> quand le chargement échoue. */
export function urlSecours(src: string): string | null {
  const h = HOTES.find((x) => src.startsWith(x + '/'));
  return h ? HOTES[1 - HOTES.indexOf(h)] + src.slice(h.length) : null;
}
