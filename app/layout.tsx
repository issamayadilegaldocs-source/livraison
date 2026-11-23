import type { Metadata, Viewport } from 'next';
import type { CSSProperties, ReactNode } from 'react';
import { Noto_Sans_Arabic, Plus_Jakarta_Sans } from 'next/font/google';
import Link from '@/app/components/Lien';
import { ChoixLangue, LangueProvider, T } from '@/lib/i18n';
import { getLivreur } from '@/lib/livreur';
import BandeauHorsLigne from './components/BandeauHorsLigne';
import BandeauLivreur from './components/BandeauLivreur';
import BandePromo from './components/BandePromo';
import { vueClient } from '@/lib/commission';
import BandeauInstaller from './components/BandeauInstaller';
import BoutonCompte from './components/BoutonCompte';
import LogoDynamique, { NomSiteDynamique } from './components/LogoDynamique';
import MasquerEntete from './components/MasquerEntete';
import NavBasClient from './components/NavBasClient';
import './globals.css';

const jakarta = Plus_Jakarta_Sans({ subsets: ['latin'], variable: '--font-jakarta', display: 'swap' });

const arabe = Noto_Sans_Arabic({ subsets: ['arabic'], variable: '--font-arabe', display: 'swap' });

export function generateMetadata(): Metadata {
  const l = getLivreur();
  return {
    title: `${l.nom} — livraison à ${l.ville}`,
    description: l.slogan,
    // « Ajouter à l'écran d'accueil » : le site s'ouvre comme une appli (manifest.ts, icon.tsx, apple-icon.tsx).
    appleWebApp: { capable: true, title: l.nom, statusBarStyle: 'default' },
  };
}

// viewportFit 'cover' : sans lui, env(safe-area-inset-*) vaut 0 sur iPhone. themeColor : barre du navigateur aux couleurs du livreur.
export function generateViewport(): Viewport {
  return { width: 'device-width', initialScale: 1, viewportFit: 'cover', themeColor: getLivreur().couleur };
}

export default function RootLayout({ children }: { children: ReactNode }) {
  const l = getLivreur();
  return (
    <html lang="fr" className={`${jakarta.variable} ${arabe.variable}`}>
      <body style={{ '--couleur': l.couleur } as CSSProperties} className="min-h-dvh font-sans antialiased">
        <LangueProvider>
        <MasquerEntete />
        <BandeauHorsLigne />
        <BandeauInstaller nom={l.nom} />
        <header className="entete sticky top-0 z-30 border-b border-black/5 bg-white/95 pt-[env(safe-area-inset-top)] backdrop-blur">
          <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))]">
            <Link href="/" className="flex min-w-0 items-center gap-2.5">
              <LogoDynamique logoDefaut={l.logo} couleur={l.couleur} />
              <span className="min-w-0">
                <span className="block truncate text-[17px] font-extrabold leading-tight"><NomSiteDynamique nomDefaut={l.nom} ville={l.ville} /></span>
                <span className="block text-xs font-medium text-muted"><T k="Livraison à {ville}" v={{ ville: l.ville }} /></span>
              </span>
            </Link>
            <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
              <BoutonCompte />
              <ChoixLangue />
              <a
                href={`https://wa.me/${l.whatsapp}`}
                className="flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-[#25D366] px-3 text-sm font-bold text-white hover:opacity-90 sm:px-4"
              >
                <span aria-hidden>✆</span> <span className="hidden sm:inline"><T k="Contact" /></span>
              </a>
            </div>
          </div>
        </header>
        <BandeauLivreur service={l.service} />
        <BandePromo livraisonGratuite={l.livraisonGratuite ?? null} promos={(l.promos ?? []).filter((p) => p.actif && !p.code).map(vueClient)} />
        <main className="mx-auto max-w-6xl pb-28 pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))]">{children}</main>
        <footer className="border-t border-black/5 bg-white pt-8 pb-[max(5.5rem,env(safe-area-inset-bottom))] text-center text-sm text-muted lg:pb-[max(2rem,env(safe-area-inset-bottom))]">
          <p className="font-bold text-ink"><NomSiteDynamique nomDefaut={l.nom} /></p>
          <p className="mt-1">
            <T k="Livraison selon la distance · Paiement à la livraison · {ville}" v={{ ville: l.ville }} />
          </p>
          <p className="mx-auto mt-4 max-w-xl px-4 text-xs leading-relaxed">
            <T k="© 2026 Hamma · Tous droits réservés. Le contenu, les données et les images de ce site sont protégés. Toute copie, extraction ou utilisation sans autorisation écrite est interdite et expose à des poursuites judiciaires." />
          </p>
          <p className="mt-2 text-xs">
            <Link href="/mentions-legales" className="font-semibold underline">
              <T k="Mentions légales et propriété intellectuelle" />
            </Link>
          </p>
        </footer>
        <NavBasClient />
        </LangueProvider>
      </body>
    </html>
  );
}
