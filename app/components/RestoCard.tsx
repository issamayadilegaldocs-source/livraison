'use client';

import Link from '@/app/components/Lien';
import { useT } from '@/lib/i18n';
import Img from './Img';

export type CarteResto = {
  slug: string;
  nom: string;
  logo: string | null;
  couverture: string | null;
  note: number;
  nbAvis: number;
  delai: string;
  cuisines: string[];
  categories: string[];
  plats: string[];
  popularite: number;
  ouvert: boolean;
  libelle: string;
  /** Promo du livreur pour ce resto (« −10 % dès 15 DT »), sinon null. */
  promo?: string | null;
};

export function Etoiles({ note, nbAvis }: { note: number; nbAvis: number }) {
  if (!nbAvis) return null;
  return (
    <span className="inline-flex items-center gap-1 text-[13px] font-bold">
      <span aria-hidden className="text-saffron">★</span>
      {note.toFixed(1)}
      <span className="font-medium text-muted">({nbAvis})</span>
    </span>
  );
}

const delai = (d: string, min: string) => d.replace(/\s*min$/i, ` ${min}`);

export function RestoTile({ r, className = '' }: { r: CarteResto; className?: string }) {
  const t = useT();
  return (
    <Link href={`/resto/${r.slug}`} className={`group flex flex-col gap-3 ${className}`}>
      <div className="relative aspect-[16/10] overflow-hidden rounded-[20px] bg-white">
        <Img src={r.couverture} alt="" initiale={r.nom} className="h-full w-full text-5xl transition duration-500 group-hover:scale-105" />
        {r.delai && (
          <span className="absolute start-3 top-3 rounded-full bg-white px-2.5 py-1 text-xs font-bold">🕒 {delai(r.delai, t('min'))}</span>
        )}
        {r.promo && (
          <span className="absolute end-3 top-3 rounded-full bg-[#d6336c] px-2.5 py-1 text-xs font-extrabold text-white shadow">🏷️ {r.promo}</span>
        )}
        {!r.ouvert && (
          <div className="absolute inset-0 flex items-end bg-black/55 p-3">
            <span className="rounded-full bg-white px-3 py-1.5 text-xs font-bold">{r.libelle}</span>
          </div>
        )}
        <Img
          src={r.logo}
          alt=""
          initiale={r.nom}
          className="absolute bottom-3 end-3 h-12 w-12 rounded-2xl border-2 border-white text-lg shadow-md"
        />
      </div>
      <div className="flex flex-col gap-1 px-0.5">
        <span className="line-clamp-1 text-[17px] font-bold">{r.nom}</span>
        <span className="line-clamp-1 text-sm text-muted">{(r.cuisines.length ? r.cuisines : r.categories).slice(0, 3).join(' · ')}</span>
        <Etoiles note={r.note} nbAvis={r.nbAvis} />
      </div>
    </Link>
  );
}

export function RestoRow({ r, plat }: { r: CarteResto; plat?: string | null }) {
  const t = useT();
  return (
    <Link href={`/resto/${r.slug}`} className="flex items-center gap-4 rounded-[20px] border border-black/5 bg-white p-2.5 transition hover:shadow-md sm:p-3">
      <span className="relative h-[76px] w-[76px] shrink-0 overflow-hidden rounded-xl sm:h-24 sm:w-24">
        <Img src={r.logo ?? r.couverture} alt="" initiale={r.nom} className="h-full w-full text-2xl" />
        {!r.ouvert && <span className="absolute inset-0 bg-black/45" aria-hidden />}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="truncate text-base font-bold">{r.nom}</span>
        <span className="truncate text-sm text-muted">{(r.cuisines.length ? r.cuisines : r.categories).slice(0, 3).join(' · ')}</span>
        <span className="flex flex-wrap items-center gap-x-2 text-[13px] font-semibold">
          <Etoiles note={r.note} nbAvis={r.nbAvis} />
          {r.delai && <span>{delai(r.delai, t('min'))}</span>}
          {!r.ouvert && <span className="text-red-700">{r.libelle || t('Fermé')}</span>}
        </span>
        {r.promo && <span className="self-start rounded-full bg-[#fde7ef] px-2.5 py-1 text-xs font-extrabold text-[#b0124d]">🏷️ {r.promo}</span>}
        {plat && <span className="mt-0.5 self-start truncate rounded-lg bg-[#f1f3f9] px-2 py-1 text-xs font-semibold">{t('Plat : {p}', { p: plat })}</span>}
      </span>
      <span aria-hidden className="shrink-0 text-xl text-gray-400 rtl:-scale-x-100">›</span>
    </Link>
  );
}
