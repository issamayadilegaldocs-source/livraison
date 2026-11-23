'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from '@/app/components/Lien';
import { EVT_FAVORIS, lireFavoris } from '@/lib/app-client';

const ONGLETS = [
  { href: '/', label: 'Accueil', icone: '🏠', match: (p: string) => p === '/' },
  { href: '/c/tout', label: 'Chercher', icone: '🔍', match: (p: string) => p.startsWith('/c/') || p.startsWith('/resto') },
  { href: '/favoris', label: 'Favoris', icone: '❤️', match: (p: string) => p.startsWith('/favoris') },
  { href: '/colis', label: 'Colis', icone: '📦', match: (p: string) => p.startsWith('/colis') },
  { href: '/compte', label: 'Compte', icone: '👤', match: (p: string) => p.startsWith('/compte') },
] as const;

/** Barre d'onglets fixe style application mobile (masquée sur /admin et sur grand écran). */
export default function NavBasClient() {
  const pathname = usePathname() ?? '/';
  const [nbFav, setNbFav] = useState(0);

  useEffect(() => {
    const maj = () => setNbFav(lireFavoris().length);
    maj();
    window.addEventListener(EVT_FAVORIS, maj);
    window.addEventListener('storage', maj);
    return () => {
      window.removeEventListener(EVT_FAVORIS, maj);
      window.removeEventListener('storage', maj);
    };
  }, []);

  if (pathname.startsWith('/admin')) return null;

  return (
    <nav
      aria-label="Navigation application"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-black/10 bg-white/95 backdrop-blur pb-[env(safe-area-inset-bottom)] lg:hidden"
    >
      <div className="mx-auto grid max-w-lg grid-cols-5 px-1 py-1.5">
        {ONGLETS.map((o) => {
          const actif = o.match(pathname);
          return (
            <Link
              key={o.href}
              href={o.href}
              className={`relative flex flex-col items-center justify-center gap-0.5 rounded-xl py-1 text-[11px] font-extrabold transition ${
                actif ? 'text-primary' : 'text-muted hover:text-ink'
              }`}
            >
              <span className="relative text-lg leading-none">
                {o.icone}
                {o.href === '/favoris' && nbFav > 0 && (
                  <span className="absolute -end-2.5 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[9px] font-extrabold text-white">
                    {nbFav}
                  </span>
                )}
              </span>
              <span>{o.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
