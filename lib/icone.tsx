import { ImageResponse } from 'next/og';
import { getLivreur } from './livreur';
import { LogoLivreur } from './logo';

/** Icône de l'appli (écran d'accueil) : logo générique du livreur sur sa couleur. Servie par app/icon.tsx et app/apple-icon.tsx. */
// ponytail: n'utilise pas livreur.logo (URL relative, à charger) ; à brancher si un livreur fournit un logo carré.
export function dessinerIcone(taille: number) {
  const l = getLivreur();
  return new ImageResponse(<LogoLivreur couleur={l.couleur} taille={taille} />, { width: taille, height: taille });
}
