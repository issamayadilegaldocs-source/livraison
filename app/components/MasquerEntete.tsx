'use client';

import { useEffect } from 'react';

/** Cache l'en-tête quand on descend dans la page, le remontre dès qu'on remonte (CSS : `.entete` dans globals.css). */
export default function MasquerEntete() {
  useEffect(() => {
    const html = document.documentElement;
    let avant = scrollY;
    const surDefilement = () => {
      const y = scrollY;
      if (y < 120) delete html.dataset.entete;
      else if (Math.abs(y - avant) < 8) return; // petits mouvements : on attend d'avoir vraiment défilé
      else if (y > avant) html.dataset.entete = 'cache';
      else delete html.dataset.entete;
      avant = y;
    };
    addEventListener('scroll', surDefilement, { passive: true });
    return () => {
      removeEventListener('scroll', surDefilement);
      delete html.dataset.entete;
    };
  }, []);
  return null;
}
