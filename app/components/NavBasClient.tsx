'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from '@/app/components/Lien';
import { EVT_FAVORIS, lireFavoris } from '@/lib/app-client';

function Icone({ nom, actif }: { nom: 'home' | 'fav' | 'explore' | 'orders' | 'profile'; actif: boolean }) {
  const sw = actif ? 2.4 : 1.9;
  switch (nom) {
    case 'home':
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M3 10.5 12 3l9 7.5" />
          <path d="M5 9.5V20a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9.5" />
        </svg>
      );
    case 'fav':
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill={actif ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 21s-7-4.5-9-9a5 5 0 0 1 9-3 5 5 0 0 1 9 3c-2 4.5-9 9-9 9z" />
        </svg>
      );
    case 'explore':
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
      );
    case 'orders':
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M6 3h12a1 1 0 0 1 1 1v17l-3-2-3 2-3-2-3 2V4a1 1 0 0 1 1-1z" />
          <path d="M9 8h6M9 12h6M9 16h4" />
        </svg>
      );
    case 'profile':
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="8" r="4" />
          <path d="M4 20a8 8 0 0 1 16 0" />
        </svg>
      );
  }
}

const ONGLETS = [
  { href: '/', label: 'Accueil', icon: 'home' as const, match: (p: string) => p === '/' },
  { href: '/favoris', label: 'Favoris', icon: 'fav' as const, match: (p: string) => p.startsWith('/favoris') },
  { href: '/c/restaurants', label: 'Explorer', icon: 'explore' as const, match: (p: string) => p.startsWith('/c/') || p.startsWith('/resto') || p.startsWith('/colis') },
  { href: '/commandes', label: 'Commandes', icon: 'orders' as const, match: (p: string) => p.startsWith('/commandes') },
  { href: '/compte', label: 'Profil', icon: 'profile' as const, match: (p: string) => p.startsWith('/compte') },
] as const;

/**
 * Barre de navigation basse dockée style hamma-app (visible sur téléphone ET ordinateur).
 * 5 onglets : Accueil · Favoris · Explorer · Commandes (en cours & historique) · Profil.
 */
export default function NavBasClient() {
  const pathname = usePathname() ?? '/';
  const [nbFav, setNbFav] = useState(0);
  const [nbCmdsActives, setNbCmdsActives] = useState(0);

  useEffect(() => {
    const majFav = () => setNbFav(lireFavoris().length);
    majFav();
    window.addEventListener(EVT_FAVORIS, majFav);
    window.addEventListener('storage', majFav);
    return () => {
      window.removeEventListener(EVT_FAVORIS, majFav);
      window.removeEventListener('storage', majFav);
    };
  }, []);

  // Compte les commandes actives pour afficher le badge sur l'onglet Commandes
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

  return (
    <nav
      aria-label="Navigation application"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-[#E6EAF2] bg-white/95 shadow-[0_-4px_20px_rgba(20,26,43,0.06)] backdrop-blur pb-[env(safe-area-inset-bottom)]"
    >
      <div className="mx-auto grid max-w-xl grid-cols-5 px-1 py-1.5">
        {ONGLETS.map((o) => {
          const actif = o.match(pathname);
          const badge = o.icon === 'fav' ? nbFav : o.icon === 'orders' ? nbCmdsActives : 0;
          return (
            <Link
              key={o.href}
              href={o.href}
              className={`relative flex flex-col items-center justify-center gap-0.5 rounded-xl py-1 text-[11px] font-extrabold transition ${
                actif ? 'text-primary' : 'text-[#5B6275] hover:text-ink'
              }`}
            >
              <span className="relative flex h-6 w-6 items-center justify-center">
                <Icone nom={o.icon} actif={actif} />
                {badge > 0 && (
                  <span className="absolute -end-2.5 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-saffron px-1 text-[10px] font-extrabold text-ink shadow-sm">
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
