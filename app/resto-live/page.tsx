'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from '@/app/components/Lien';
import Img from '@/app/components/Img';
import Menu, { type PlatVue } from '@/app/resto/[slug]/Menu';
import { POURBOIRES_DEFAUT } from '@/lib/regles-livreur';
import { useReglages } from '@/lib/reglages';
import type { RestaurantGestion } from '@/lib/plateforme';

const LIVRAISON_DEFAUT = { base: 1, parKm: 0.5, min: 1, max: 12, rayonMaxKm: 15, facteurRoute: 1.3 };

export default function RestoLivePage() {
  const [slug, setSlug] = useState('');
  const [resto, setResto] = useState<RestaurantGestion | null>(null);
  const [chargement, setChargement] = useState(true);
  const [introuvable, setIntrouvable] = useState(false);

  useEffect(() => {
    const s = new URLSearchParams(window.location.search).get('slug') ?? '';
    setSlug(s);
    if (!s) {
      setIntrouvable(true);
      setChargement(false);
      return;
    }
    fetch(`/api/restos-live?slug=${encodeURIComponent(s)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.restaurant) setResto(d.restaurant);
        else setIntrouvable(true);
      })
      .catch(() => setIntrouvable(true))
      .finally(() => setChargement(false));
  }, []);

  const reglages = useReglages(slug || undefined);

  const { categories, plats } = useMemo(() => {
    const ajouts = (resto?.plats_overrides?.ajouts ?? []).filter((p) => !p.indispo);
    const nomsCat = Array.from(new Set(ajouts.map((p) => p.categorie || 'Carte')));
    const cats = nomsCat.map((nom, i) => ({ id: i + 1, nom }));
    const idParNom = new Map(cats.map((c) => [c.nom, c.id]));
    const ps: PlatVue[] = ajouts.map((p) => ({
      id: p.id,
      categorieId: idParNom.get(p.categorie || 'Carte') ?? 1,
      nom: p.nom,
      description: p.description ?? '',
      prix: p.prix,
      prixOrigine: null,
      populaire: false,
      image: p.image ?? null,
      thumb: p.image ?? null,
      full: p.image ?? null,
      groupes: [],
    }));
    return { categories: cats, plats: ps };
  }, [resto]);

  if (chargement) {
    return (
      <div className="py-8">
        <div className="h-56 animate-pulse rounded-3xl bg-white" />
      </div>
    );
  }

  if (introuvable || !resto) {
    return (
      <div className="mx-auto max-w-lg py-12 text-center">
        <h1 className="text-2xl font-extrabold">Restaurant introuvable</h1>
        <p className="mt-2 text-sm text-muted">Ce restaurant n’existe pas ou a été supprimé.</p>
        <Link href="/c/restaurants" className="mt-4 inline-flex h-11 items-center rounded-full bg-primary px-6 text-sm font-extrabold text-white">
          Voir tous les restaurants
        </Link>
      </div>
    );
  }

  const nom = resto.nom || resto.slug;
  const ouvert = resto.actif && !(reglages?.pause ?? false) && !(reglages?.restosFermes.includes(resto.slug) ?? false);
  const messageFerme = !resto.actif ? 'Ce restaurant est indisponible pour le moment.' : reglages?.pause ? 'Livreur en pause' : null;

  return (
    <>
      <div className="pt-4">
        <Link href="/c/restaurants" className="text-sm font-semibold text-muted hover:underline">
          ← Restaurants
        </Link>
      </div>
      <section className="mt-3 overflow-hidden rounded-[28px] bg-white">
        <div className="relative h-40 sm:h-64">
          <Img src={resto.image} alt="" initiale={nom} className="h-full w-full text-6xl" />
        </div>
        <div className="relative flex flex-col gap-3 px-5 pb-5 sm:flex-row sm:items-end sm:gap-5 sm:px-8">
          <Img
            src={resto.image}
            alt={`Logo ${nom}`}
            initiale={nom}
            className="-mt-10 h-20 w-20 shrink-0 rounded-2xl border-4 border-white text-2xl shadow-md sm:-mt-12 sm:h-24 sm:w-24"
          />
          <div className="min-w-0 flex-1">
            <h1 className="m-0 text-3xl font-extrabold tracking-tight sm:text-4xl">{nom}</h1>
            {(resto.cuisines?.length ?? 0) > 0 && <p className="mt-1 text-sm text-muted">{resto.cuisines!.join(' · ')}</p>}
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm font-semibold">
              {resto.delai && <span>🕒 {resto.delai}</span>}
              <span className={ouvert ? 'text-green-700' : 'text-red-700'}>{ouvert ? 'Ouvert' : 'Indisponible'}</span>
            </div>
            {resto.adresse && <p className="mt-1 text-sm text-muted">📍 {resto.adresse}</p>}
          </div>
        </div>
      </section>
      {plats.length === 0 ? (
        <div className="mt-6 rounded-3xl bg-white p-8 text-center text-sm text-muted">
          Le menu de ce restaurant est en cours de préparation.
        </div>
      ) : (
        <Menu
          slug={resto.slug}
          nomResto={nom}
          categories={categories}
          plats={plats}
          livraison={reglages?.livraison ?? LIVRAISON_DEFAUT}
          fraisService={reglages?.fraisService ?? null}
          livraisonGratuite={reglages?.livraisonGratuite ?? null}
          regles={reglages ? { commandeMin: reglages.commandeMin, supplement: reglages.supplement, pourboires: reglages.pourboires } : { commandeMin: null, supplement: null, pourboires: POURBOIRES_DEFAUT }}
          promos={reglages?.promos ?? []}
          restoPosition={resto.position ?? { lat: 34.7406, lng: 10.7603 }}
          ouvert={ouvert}
          libelle={ouvert ? 'Ouvert' : 'Indisponible'}
          messageFerme={messageFerme}
        />
      )}
    </>
  );
}
