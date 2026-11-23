'use client';

import { useEffect, useState } from 'react';
import Link from '@/app/components/Lien';
import { ecrirePanierActif, EVT_PANIER, lirePanierActif, type PanierActif } from '@/lib/app-client';

const fmtPrix = (n: number) => `${Number(n).toFixed(3).replace('.', ',')} DT`;

export default function PagePanier() {
  const [panier, setPanier] = useState<PanierActif | null>(null);

  useEffect(() => {
    const maj = () => setPanier(lirePanierActif());
    maj();
    window.addEventListener(EVT_PANIER, maj);
    return () => window.removeEventListener(EVT_PANIER, maj);
  }, []);

  function viderTout() {
    if (panier?.slug) {
      try {
        localStorage.removeItem(`panier:${panier.slug}`);
      } catch {
        /* ignore */
      }
    }
    ecrirePanierActif(null);
    setPanier(null);
  }

  return (
    <div className="mx-auto max-w-lg py-6">
      <h1 className="m-0 text-2xl font-extrabold tracking-tight">🛍️ Mon panier</h1>
      <p className="m-0 mt-1 text-xs text-muted">Accès rapide à votre commande en cours.</p>

      {panier && panier.nbArticles > 0 ? (
        <div className="mt-5 flex flex-col gap-4 rounded-3xl border border-black/5 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="m-0 text-xs font-bold uppercase text-muted">Restaurant</p>
              <p className="m-0 mt-0.5 text-lg font-extrabold text-ink">{panier.nomResto}</p>
              <p className="m-0 mt-0.5 text-xs font-semibold text-primary">
                {panier.nbArticles} {panier.nbArticles > 1 ? 'articles' : 'article'} dans votre panier
              </p>
            </div>
            <p className="m-0 text-xl font-extrabold text-ink">{fmtPrix(panier.sousTotal)}</p>
          </div>

          <Link
            href={`${panier.href}${panier.href.includes('?') ? '&' : '?'}panier=1`}
            className="flex h-12 w-full items-center justify-center rounded-2xl bg-primary text-sm font-extrabold text-white shadow-sm hover:opacity-95"
          >
            Finaliser ma commande ({fmtPrix(panier.sousTotal)}) →
          </Link>

          <div className="flex items-center justify-between text-xs">
            <Link href={panier.href} className="font-bold text-primary underline">
              + Ajouter d’autres plats
            </Link>
            <button type="button" onClick={viderTout} className="font-bold text-red-700 underline">
              Vider le panier
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-5 rounded-3xl border border-black/5 bg-white p-8 text-center shadow-sm">
          <p className="m-0 text-4xl">🛍️</p>
          <p className="m-0 mt-2 text-base font-extrabold text-ink">Votre panier est vide</p>
          <p className="m-0 mt-1 text-xs text-muted">
            Choisissez un restaurant et ajoutez vos plats préférés en 1 clic.
          </p>
          <Link
            href="/c/restaurants"
            className="mt-4 inline-flex h-11 items-center rounded-2xl bg-primary px-6 text-sm font-extrabold text-white"
          >
            Découvrir les restaurants
          </Link>
        </div>
      )}
    </div>
  );
}
