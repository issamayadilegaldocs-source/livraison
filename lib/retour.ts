'use client';

import { useEffect, useRef } from 'react';

/**
 * Bouton retour du téléphone (Android, glissement iOS) : il ferme l'écran plein écran du dessus au lieu de quitter la page.
 * Chaque écran ouvert pousse une entrée d'historique ; seul l'écran du dessus réagit au retour.
 * `retour()` renvoie `true` si l'écran reste ouvert (il est revenu à son étape précédente) : on remet alors une entrée.
 */
type Entree = { retour: () => boolean; consommee: boolean };

const pile: Entree[] = [];
let aIgnorer = 0; // `popstate` provoqués par nos propres `history.back()` (fermeture par un bouton de l'écran)

function surPop() {
  if (aIgnorer > 0) {
    aIgnorer--;
    return;
  }
  const haut = pile[pile.length - 1];
  if (!haut) return;
  if (haut.retour()) history.pushState(null, '');
  else haut.consommee = true;
}

/** Ouvre un niveau ; la fonction renvoyée le ferme (et retire son entrée d'historique si le retour ne l'a pas déjà fait). */
export function ouvrirNiveau(retour: () => boolean): () => void {
  const e: Entree = { retour, consommee: false };
  if (!pile.length) window.addEventListener('popstate', surPop);
  pile.push(e);
  history.pushState(null, '');
  return () => {
    pile.splice(pile.indexOf(e), 1);
    if (!pile.length) window.removeEventListener('popstate', surPop);
    // ponytail: rouvrir un écran pendant ce back() asynchrone peut perdre une entrée ; acceptable (double tap rare).
    if (!e.consommee) {
      aIgnorer++;
      history.back();
    }
  };
}

/** Tant que `actif`, le retour du téléphone appelle `retour` (dernière version, pas besoin de la mémoriser). */
export function useRetour(actif: boolean, retour: () => boolean) {
  const r = useRef(retour);
  r.current = retour;
  useEffect(() => (actif ? ouvrirNiveau(() => r.current()) : undefined), [actif]);
}
