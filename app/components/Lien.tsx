import type { AnchorHTMLAttributes } from 'react';

// Lien interne = <a> classique. Avec next/link, la navigation télécharge /…/page.txt en arrière-plan (données RSC) ;
// si ce téléchargement échoue (réseau, redéploiement), le navigateur affiche le texte brut. Un <a> recharge la vraie page.
export default function Lien(props: AnchorHTMLAttributes<HTMLAnchorElement>) {
  // eslint-disable-next-line jsx-a11y/anchor-has-content
  return <a {...props} />;
}
