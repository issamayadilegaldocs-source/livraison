'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from '@/app/components/Lien';
import {
  EVT_FAVORIS,
  EVT_OUVRIR_PANIER,
  EVT_PANIER,
  lireFavoris,
  lirePanierActif,
  type PanierActif,
} from '@/lib/app-client';

function Icone({ nom, actif }: { nom: 'home' | 'fav' | 'cart' | 'orders' | 'profile'; actif: boolean }) {
  const sw = actif ? 2.3 : 1.85;
  switch (nom) {
    case 'home':
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M3 10.5 12 3l9 7.5" />
          <path d="M5 9.5V20a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9.5" />
          <path d="M9.5 21v-6h5v6" />
        </svg>
      );
    case 'fav':
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill={actif ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 21s-7-4.5-9-9a5 5 0 0 1 9-3 5 5 0 0 1 9 3c-2 4.5-9 9-9 9z" />
        </svg>
      );
    case 'cart':
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M6 8h12l-1 12a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L6 8z" />
          <path d="M9 8V6a3 3 0 0 1 6 0v2" />
        </svg>
      );
    case 'orders':
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="5" y="4" width="14" height="17" rx="2" />
          <path d="M9 4V3a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1" />
          <path d="m9 13 2 2 4-4" />
        </svg>
      );
    case 'profile':
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="9.5" />
          <circle cx="12" cy="9.5" r="3" />
          <path d="M6.8 18.8a6.2 6.2 0 0 1 10.4 0" />
        </svg>
      );
  }
}

const ONGLETS = [
  { href: '/', label: 'Accueil', icon: 'home' as const, match: (p: string) => p === '/' || p.startsWith('/c/') || p.startsWith('/colis') },
  { href: '/favoris', label: 'Favoris', icon: 'fav' as const, match: (p: string) => p.startsWith('/favoris') },
  { href: '/panier', label: 'Panier', icon: 'cart' as const, match: (p: string) => p.startsWith('/panier') },
  { href: '/commandes', label: 'Commandes', icon: 'orders' as const, match: (p: string) => p.startsWith('/commandes') },
  { href: '/compte', label: 'Profil', icon: 'profile' as const, match: (p: string) => p.startsWith('/compte') },
] as const;

/**
 * Barre de navigation basse dockée identique à l'application mobile (téléphone & PC) :
 * Accueil · Favoris · Panier (badge jaune en direct) · Commandes · Profil.
 */
export default function NavBasClient() {
  const pathname = usePathname() ?? '/';
  const router = useRouter();
  const [nbFav, setNbFav] = useState(0);
  const [panier, setPanier] = useState<PanierActif | null>(null);
  const [nbCmdsActives, setNbCmdsActives] = useState(0);

  useEffect(() => {
    const majFav = () => setNbFav(lireFavoris().length);
    const majPanier = () => setPanier(lirePanierActif());
    majFav();
    majPanier();
    window.addEventListener(EVT_FAVORIS, majFav);
    window.addEventListener(EVT_PANIER, majPanier);
    window.addEventListener('storage', majFav);
    window.addEventListener('storage', majPanier);
    return () => {
      window.removeEventListener(EVT_FAVORIS, majFav);
      window.removeEventListener(EVT_PANIER, majPanier);
      window.removeEventListener('storage', majFav);
      window.removeEventListener('storage', majPanier);
    };
  }, []);

  useEffect(() => {
    if (pathname.startsWith('/admin')) return;
    fetch('/api/compte/commandes', { credentials: 'same-origin' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d?.commandes) return;
        const actives = (d.commandes as { statut: string }[]).filter(
          (c) => c.statut !== 'livree' && c.statut !== 'annulee',
        ).length;
        setNbCmdsActives(actives);
      })
      .catch(() => {});
  }, [pathname]);

  if (pathname.startsWith('/admin')) return null;

  function ouvrirPanierRapide(e: React.MouseEvent) {
    // Si on est déjà sur la page du resto, on ouvre directement le tiroir panier sans scroller ni recharger !
    if (pathname.startsWith('/resto/') || pathname.startsWith('/resto-live')) {
      e.preventDefault();
      window.dispatchEvent(new Event(EVT_OUVRIR_PANIER));
      return;
    }
    // Si un panier actif existe sur un resto, on y saute directement avec le panier déjà ouvert !
    if (panier && panier.nbArticles > 0 && panier.href) {
      e.preventDefault();
      const sep = panier.href.includes('?') ? '&' : '?';
      router.push(`${panier.href}${sep}panier=1`);
    }
  }

  return (
    <nav
      aria-label="Navigation application"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-[#E6EAF2] bg-white/95 shadow-[0_-4px_20px_rgba(20,26,43,0.06)] backdrop-blur pb-[env(safe-area-inset-bottom)]"
    >
      <div className="mx-auto grid max-w-xl grid-cols-5 px-1 py-1.5">
        {ONGLETS.map((o) => {
          const actif = o.match(pathname);
          const badge =
            o.icon === 'cart'
              ? (panier?.nbArticles ?? 0)
              : o.icon === 'fav'
                ? nbFav
                : o.icon === 'orders'
                  ? nbCmdsActives
                  : 0;
          return (
            <Link
              key={o.href}
              href={o.href}
              onClick={o.icon === 'cart' ? ouvrirPanierRapide : undefined}
              className={`relative flex flex-col items-center justify-center gap-0.5 rounded-xl py-1 text-[11px] font-bold transition ${
                actif ? 'text-primary' : 'text-[#5B6275] hover:text-ink'
              }`}
            >
              <span className="relative flex h-6 w-6 items-center justify-center">
                <Icone nom={o.icon} actif={actif} />
                {badge > 0 && (
                  <span className="absolute -end-2.5 -top-1.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-saffron px-1 text-[10px] font-extrabold text-ink shadow-sm">
                    {badge}
                  </span>
                )}
              </span>
              <span className="leading-none">{o.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
