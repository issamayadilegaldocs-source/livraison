import Link from '@/app/components/Lien';
import type { ReactNode } from 'react';
import { getRestos } from '@/lib/catalogue';
import { T } from '@/lib/i18n';
import { getLivreur } from '@/lib/livreur';
import { NOMS_TYPES, typesCommerce, type TypeCommerce } from '@/lib/types-commerce';
import ChampAccueil from './components/ChampAccueil';
import { IlluAnimaux, IlluBurger, IlluCafe, IlluColis, IlluEpicerie, IlluFleurs, IlluPara, IlluPatisserie } from './components/Illustrations';

// Accueil pensé pour tenir sur un écran de téléphone : Restaurants, Colis, puis les commerces de la ville.
// Page statique ; la pause et les horaires du livreur s'affichent dans le bandeau du layout.

const TUILES: { type: Exclude<TypeCommerce, 'restaurants'>; teinte: string; Illu: (p: { className?: string }) => ReactNode }[] = [
  { type: 'epicerie', teinte: '#e6f6ec', Illu: IlluEpicerie },
  { type: 'patisserie', teinte: '#fdeaf1', Illu: IlluPatisserie },
  { type: 'cafe', teinte: '#fdf0e1', Illu: IlluCafe },
  { type: 'fleurs', teinte: '#eeeafd', Illu: IlluFleurs },
  { type: 'para', teinte: '#e5f1fd', Illu: IlluPara },
  { type: 'animaux', teinte: '#fdf6d8', Illu: IlluAnimaux },
];

const Fleche = ({ taille = 16 }: { taille?: number }) => (
  <svg className="rtl:-scale-x-100" width={taille} height={taille} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M5 12h14" />
    <path d="m13 6 6 6-6 6" />
  </svg>
);

export default function Accueil() {
  const l = getLivreur();
  const restos = getRestos();
  const nb = (t: TypeCommerce) => restos.filter((r) => typesCommerce(r).includes(t)).length;
  const tuiles = TUILES.filter((t) => nb(t.type) > 0); // une ville sans fleuriste n'affiche pas la tuile

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-3 py-3 lg:max-w-none lg:gap-6 lg:py-8">
      <h1 className="sr-only">
        <T k="{nom} — livraison à {ville}" v={{ nom: l.nom, ville: l.ville }} />
      </h1>

      <form action="/c/tout" className="flex h-[50px] items-center gap-2.5 rounded-2xl border border-black/10 bg-white px-4 lg:h-14 lg:max-w-2xl">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4b5563" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
        <ChampAccueil />
      </form>

      <div className="flex flex-col gap-3 lg:grid lg:grid-cols-5 lg:gap-6">
      <Link href="/c/restaurants" className="relative flex h-[168px] shrink-0 flex-col gap-1 overflow-hidden rounded-3xl bg-primary px-[18px] pb-4 pt-[18px] text-white lg:col-span-3 lg:h-[300px] lg:gap-2 lg:p-10">
        <span aria-hidden className="absolute -end-9 -top-9 h-40 w-40 rounded-full bg-white/10 lg:h-80 lg:w-80" />
        <IlluBurger className="absolute -end-2 top-0.5 h-[150px] w-[150px] lg:end-10 lg:top-6 lg:h-[250px] lg:w-[250px]" />
        <span className="relative self-start rounded-full bg-white/20 px-2.5 py-1 text-xs font-bold"><T k="{n} restos à {ville}" v={{ n: nb('restaurants'), ville: l.ville }} /></span>
        <span className="relative mt-1 text-[28px] font-extrabold tracking-tight lg:text-5xl"><T k="Restaurants" /></span>
        <span className="relative text-[13px] font-medium text-white/90 lg:text-lg"><T k="Pizza, makloub, tacos, plats…" /></span>
        <span className="relative mt-auto inline-flex h-10 items-center gap-2 self-start rounded-full bg-white px-4 text-sm font-extrabold text-ink lg:h-12 lg:px-6 lg:text-base">
          <T k="Voir les restos" /> <Fleche />
        </span>
      </Link>

      <Link href="/colis" className="flex shrink-0 items-center gap-3 rounded-[22px] bg-ink py-3 ps-3 pe-4 text-white lg:relative lg:col-span-2 lg:h-[300px] lg:flex-col lg:items-start lg:justify-center lg:overflow-hidden lg:rounded-3xl lg:p-8">
        <IlluColis className="-my-1.5 -ms-2 h-[92px] w-[92px] shrink-0 lg:absolute lg:end-2 lg:top-1/2 lg:m-0 lg:h-48 lg:w-48 lg:-translate-y-1/2" />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5 lg:relative lg:max-w-[58%] lg:flex-none lg:gap-2">
          <span className="flex items-center gap-2 lg:flex-col-reverse lg:items-start">
            <span className="text-[19px] font-extrabold lg:text-3xl"><T k="Envoyer un colis" /></span>
            <span className="rounded-full bg-saffron px-2 py-0.5 text-[11px] font-extrabold text-ink"><T k="Nouveau" /></span>
          </span>
          <span className="text-[13px] font-medium text-white/85 lg:text-base"><T k="Ramassé chez vous, livré partout dans {ville}" v={{ ville: l.ville }} /></span>
        </span>
        <span aria-hidden className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-saffron text-ink lg:relative lg:mt-2 lg:h-12 lg:w-auto lg:gap-2 lg:px-6 lg:[display:inline-flex] lg:items-center lg:font-extrabold">
          <span className="hidden lg:inline"><T k="Envoyer" /></span>
          <Fleche taille={18} />
        </span>
      </Link>
      </div>

      {tuiles.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="m-0 text-base font-extrabold lg:text-2xl"><T k="Commerces de {ville}" v={{ ville: l.ville }} /></h2>
          <div className="grid grid-cols-3 gap-2.5 lg:grid-cols-6 lg:gap-5">
            {tuiles.map(({ type, teinte, Illu }) => (
              <Link key={type} href={`/c/${type}`} style={{ background: teinte }} className="flex flex-col items-center gap-1.5 rounded-[20px] p-1.5 pb-2.5 text-ink transition hover:-translate-y-0.5 hover:shadow-md lg:gap-3 lg:p-2.5 lg:pb-4">
                <span className="block h-24 w-full overflow-hidden rounded-[14px] bg-white lg:h-40">
                  <Illu className="block h-full w-full" />
                </span>
                <span className="text-center text-[13px] font-extrabold leading-tight lg:text-base"><T k={NOMS_TYPES[type]} /></span>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
