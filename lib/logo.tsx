/**
 * Logo générique d'un livreur : un sac de livraison avec une épingle, sur la couleur du livreur.
 * Utilisé quand livreur.json n'a pas de `logo` (en-tête du site, app/icon.tsx, app/apple-icon.tsx).
 * Aucune lettre ni nom : le même dessin convient à tous les livreurs, seule la couleur change.
 */
export function LogoLivreur({ couleur, taille }: { couleur: string; taille: number }) {
  return (
    <svg viewBox="0 0 256 256" width={taille} height={taille} aria-hidden="true">
      <rect width="256" height="256" rx="56" fill={couleur} />
      <path d="M100 88V76a28 28 0 0 1 56 0v12" fill="none" stroke="#fff" strokeWidth="12" strokeLinecap="round" />
      <rect x="60" y="88" width="136" height="116" rx="26" fill="#fff" />
      <path d="M60 126h136" stroke={couleur} strokeOpacity="0.25" strokeWidth="6" />
      <path d="M128 138c-12 0-21 9-21 20 0 15 21 32 21 32s21-17 21-32c0-11-9-20-21-20z" fill="#FFC83D" />
      <circle cx="128" cy="158" r="8" fill={couleur} />
    </svg>
  );
}
