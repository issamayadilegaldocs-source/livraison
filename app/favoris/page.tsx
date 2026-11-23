'use client';

import { useEffect, useState } from 'react';
import Link from '@/app/components/Lien';
import Img from '@/app/components/Img';
import { basculerFavori, EVT_FAVORIS, lireFavoris, type RestoFavori } from '@/lib/app-client';

export default function PageFavoris() {
  const [favoris, setFavoris] = useState<RestoFavori[]>([]);

  useEffect(() => {
    const maj = () => setFavoris(lireFavoris());
    maj();
    window.addEventListener(EVT_FAVORIS, maj);
    return () => window.removeEventListener(EVT_FAVORIS, maj);
  }, []);

  return (
    <div className="mx-auto max-w-2xl py-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="m-0 text-2xl font-extrabold tracking-tight">❤️ Mes favoris</h1>
          <p className="m-0 mt-0.5 text-xs text-muted">Vos restaurants préférés accessibles en 1 clic.</p>
        </div>
        <Link href="/c/restaurants" className="rounded-xl bg-primary/10 px-3.5 py-2 text-xs font-extrabold text-primary">
          Explorer →
        </Link>
      </div>

      {favoris.length === 0 ? (
        <div className="rounded-3xl border border-black/5 bg-white p-8 text-center shadow-sm">
          <p className="m-0 text-4xl">🤍</p>
          <p className="m-0 mt-2 text-base font-extrabold text-ink">Aucun restaurant favori pour le moment</p>
          <p className="m-0 mt-1 text-xs text-muted">
            Appuyez sur le cœur sur un restaurant pour le retrouver rapidement ici.
          </p>
          <Link
            href="/c/restaurants"
            className="mt-4 inline-flex h-11 items-center rounded-2xl bg-primary px-5 text-sm font-extrabold text-white"
          >
            Découvrir les restaurants
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {favoris.map((r) => (
            <div
              key={r.slug}
              className="flex items-center gap-3 rounded-3xl border border-black/5 bg-white p-3 shadow-sm"
            >
              <Link href={r.href ?? `/resto/${r.slug}`} className="flex min-w-0 flex-1 items-center gap-3">
                <span className="relative h-16 w-16 shrink-0 overflow-hidden rounded-2xl">
                  <Img src={r.logo ?? r.couverture ?? null} alt="" initiale={r.nom} className="h-full w-full text-xl" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-base font-extrabold text-ink">{r.nom}</span>
                  {r.cuisines && r.cuisines.length > 0 && (
                    <span className="block truncate text-xs text-muted">{r.cuisines.slice(0, 3).join(' · ')}</span>
                  )}
                  {r.delai && <span className="mt-0.5 inline-block text-xs font-bold text-primary">🕒 {r.delai}</span>}
                </span>
              </Link>
              <button
                type="button"
                onClick={() => setFavoris(basculerFavori(r))}
                aria-label={`Retirer ${r.nom} des favoris`}
                className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-red-50 text-lg text-red-600 hover:bg-red-100"
              >
                ❤️
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
