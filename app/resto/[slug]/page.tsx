import { vueClient } from '@/lib/commission';
import { POURBOIRES_DEFAUT } from '@/lib/regles-livreur';
import type { Metadata } from 'next';
import Link from '@/app/components/Lien';
import { notFound } from 'next/navigation';
import { getMenu, getResto, getRestos, imageUrl } from '@/lib/catalogue';
import { T } from '@/lib/i18n';
import { getLivreur } from '@/lib/livreur';
import AvisRestoSection from '../../components/AvisRestoSection';
import Img from '../../components/Img';
import { Etoiles } from '../../components/RestoCard';
import { MenuVivant, StatutResto } from './Vivant';

// Une page statique par resto, construite au build.
export const dynamicParams = false;
export function generateStaticParams() {
  return getRestos().map((r) => ({ slug: r.slug }));
}

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const r = getResto((await params).slug);
  return r ? { title: `${r.nom} — ${getLivreur().nom}`, description: `Commandez chez ${r.nom} à ${getLivreur().ville}.` } : {};
}

export default async function RestoPage({ params }: Params) {
  const resto = getResto((await params).slug);
  const menu = resto && getMenu(resto.id);
  if (!resto || !menu) notFound();

  return (
    <>
      <div className="pt-4">
        <Link href="/" className="text-sm font-semibold text-muted hover:underline">
          <T k="← Accueil" />
        </Link>
      </div>
      <section className="mt-3 overflow-hidden rounded-[28px] bg-white">
        <div className="relative h-40 sm:h-64">
          <Img src={imageUrl('restaurant', resto.couverture, 'full')} alt="" initiale={resto.nom} className="h-full w-full text-6xl" />
        </div>
        <div className="relative flex flex-col gap-3 px-5 pb-5 sm:flex-row sm:items-end sm:gap-5 sm:px-8">
          <Img
            src={imageUrl('restaurant', resto.logo, 'thumb')}
            alt={`Logo ${resto.nom}`}
            initiale={resto.nom}
            className="-mt-10 h-20 w-20 shrink-0 rounded-2xl border-4 border-white text-2xl shadow-md sm:-mt-12 sm:h-24 sm:w-24"
          />
          <div className="min-w-0 flex-1">
            <h1 className="m-0 text-3xl font-extrabold tracking-tight sm:text-4xl">{resto.nom}</h1>
            <p className="mt-1 text-sm text-muted">{[...resto.cuisines, ...resto.categories.slice(0, 3)].slice(0, 4).join(' · ')}</p>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm font-semibold">
              <Etoiles note={resto.note} nbAvis={resto.nbAvis} />
              {resto.delai && <span>🕒 {resto.delai}</span>}
              <StatutResto horaires={resto.horaires} />
            </div>
            {resto.adresse && <p className="mt-1 text-sm text-muted">📍 {resto.adresse}</p>}
          </div>
        </div>
      </section>
      <MenuVivant
        slug={resto.slug}
        nomResto={resto.nom}
        horaires={resto.horaires}
        service={getLivreur().service}
        livraison={getLivreur().livraison}
        fraisService={getLivreur().fraisService ?? null}
        livraisonGratuite={getLivreur().livraisonGratuite ?? null}
        regles={{ commandeMin: null, supplement: null, pourboires: POURBOIRES_DEFAUT }}
        promos={(getLivreur().promos ?? []).filter((p) => p.actif && !p.code).map(vueClient)}
        restoPosition={resto.position}
      />
      <AvisRestoSection slug={resto.slug} nom={resto.nom} />
    </>
  );
}
