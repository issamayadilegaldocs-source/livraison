'use client';

import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import type { Horaire } from '@/lib/catalogue';
import { estOuvert, libelleHoraire } from '@/lib/horaires';
import { useT } from '@/lib/i18n';
import { useMaintenant } from '@/lib/maintenant';
import { messageArret, type Service } from '@/lib/service';
import { useReglages } from '@/lib/reglages';
import { etiquettePromo, type PromoVue } from '@/lib/commission';
import { correspond } from '@/lib/filtres-plats';
import { normaliser, rechercher } from '@/lib/recherche';
import type { RestaurantGestion } from '@/lib/plateforme';
import Img from './components/Img';
import { RestoRow, RestoTile, type CarteResto } from './components/RestoCard';

/** Resto tel qu'il est figé dans le HTML statique : sans ouvert/fermé (calculé ici) ni plats (chargés à la demande). */
export type RestoAccueil = Omit<CarteResto, 'ouvert' | 'libelle' | 'plats'> & { horaires: Horaire[] };

type Props = {
  restos: RestoAccueil[];
  cuisines: { nom: string; image: string | null }[];
  livreur: { nom: string; slogan: string; ville: string; service?: Service };
  /** Promos actives au moment du build (remplacées par celles de /api/etat dès qu'elles arrivent). */
  promos: PromoVue[];
  /** Titre de la page de catégorie (« Restaurants », « Épicerie »…). */
  titre: string;
  /** Type de commerce courant (ex. 'restaurants', 'epicerie', 'tout'). */
  typeCommerce?: string;
};

const PAGE = 24;
const titre = 'm-0 text-[17px] font-extrabold tracking-tight sm:text-[28px]';

/** Charge la suite quand on arrive en bas de la liste ; le bouton « Voir plus » reste (sans JS, clavier). */
function Suite({ reste, plus }: { reste: number; plus: () => void }) {
  const t = useT();
  const ref = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver((e) => e[0].isIntersecting && plus(), { rootMargin: '400px' });
    obs.observe(el);
    return () => obs.disconnect();
  }, [plus, reste]);
  return (
    <button ref={ref} type="button" onClick={plus} className="mx-auto h-12 rounded-full border border-black/10 bg-white px-6 text-sm font-bold hover:shadow-sm">
      {t('Voir plus ({n} restants)', { n: reste })}
    </button>
  );
}

function Section({ titre: t, children }: { titre: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-5">
      <h2 className={titre}>{t}</h2>
      {children}
    </section>
  );
}

function Tuiles({ restos }: { restos: CarteResto[] }) {
  return (
    <div className="no-scrollbar -me-4 flex gap-4 overflow-x-auto pb-1 pe-4 sm:me-0 sm:grid sm:grid-cols-2 sm:gap-6 sm:overflow-visible sm:pe-0 lg:grid-cols-3">
      {restos.map((r) => (
        <RestoTile key={r.slug} r={r} className="w-[260px] shrink-0 sm:w-auto" />
      ))}
    </div>
  );
}

export default function Discovery({ restos: statiques, cuisines, livreur, promos, titre, typeCommerce = 'tout' }: Props) {
  const t = useT();
  const [q, setQ] = useState('');
  const [liveRestos, setLiveRestos] = useState<{ overrides: Record<string, RestaurantGestion>; custom: RestaurantGestion[] } | null>(null);
  // Recherche lancée depuis l'accueil (/c/tout?q=…) : page statique, on lit l'URL au montage.
  useEffect(() => {
    const depart = new URLSearchParams(window.location.search).get('q');
    if (depart) setQ(depart);
    fetch('/api/restos-live')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setLiveRestos({ overrides: d.overrides ?? {}, custom: d.custom ?? [] }))
      .catch(() => {});
  }, []);
  const requete = useDeferredValue(q);
  const maintenant = useMaintenant();
  const [plats, setPlats] = useState<Record<string, string[]> | null>(null);

  // Noms de plats : chargés à la première recherche (la recherche par nom de resto marche sans).
  const chercheActive = q.trim() !== '';
  useEffect(() => {
    if (!chercheActive || plats) return;
    fetch('/recherche.json')
      .then((r) => (r.ok ? r.json() : null))
      .then((p) => p && setPlats(p))
      .catch(() => {});
  }, [chercheActive, plats]);

  // Pause et horaires du livreur : ceux de sa page de config (/api/etat), sinon ceux du build. S'il ne prend pas
  // de commandes, tous les restos sont grisés (le grand bandeau en haut de page dit pourquoi et jusqu'à quand).
  const reglages = useReglages();
  const service = reglages ? (reglages.service ?? undefined) : livreur.service;
  const arret = maintenant ? messageArret(service, reglages?.pause ?? false, maintenant, reglages?.retour ?? undefined, t) : null;
  const stop = arret ? (reglages?.pause ? t('Livreur en pause') : t('Livraison fermée')) : null;

  // Promos du livreur : celles de sa page de config (/api/etat), sinon celles du build.
  const promosVigueur = reglages ? reglages.promos : promos;
  const fermes = useMemo(() => new Set(reglages?.restosFermes ?? []), [reglages]);

  // Avant l'hydratation (HTML statique), tout est affiché « ouvert » sans libellé : rien de faux ne s'affiche.
  const restos: CarteResto[] = useMemo(() => {
    const overrides = liveRestos?.overrides ?? {};
    const customRows = (liveRestos?.custom ?? [])
      .filter((c) => c.actif && (typeCommerce === 'tout' || (c.type_commerce ?? 'restaurants') === typeCommerce))
      .map((c): CarteResto => {
        const ajouts = (c.plats_overrides?.ajouts ?? []).filter((p) => !p.indispo);
        return {
          slug: c.slug,
          nom: c.nom || c.slug,
          logo: c.image || null,
          couverture: c.image || null,
          note: 5,
          nbAvis: 0,
          delai: c.delai || '25-35 min',
          cuisines: c.cuisines ?? [],
          categories: Array.from(new Set(ajouts.map((p) => p.categorie || 'Carte'))),
          plats: ajouts.map((p) => p.nom),
          popularite: 999999,
          ouvert: !stop && !fermes.has(c.slug),
          libelle: stop ?? (fermes.has(c.slug) ? t('Indisponible') : ''),
          promo: etiquettePromo(promosVigueur, c.slug, t('dès'), t('Plats en promo'))?.texte ?? null,
          href: `/resto-live?slug=${encodeURIComponent(c.slug)}`,
        };
      });

    const statiquesFiltres = statiques
      .filter((r) => overrides[r.slug]?.actif !== false)
      .map(({ horaires, ...r }) => {
        const ov = overrides[r.slug];
        return {
          ...r,
          ...(ov?.nom ? { nom: ov.nom } : {}),
          ...(ov?.cuisines?.length ? { cuisines: ov.cuisines } : {}),
          ...(ov?.delai ? { delai: ov.delai } : {}),
          ...(ov?.image ? { couverture: ov.image, logo: ov.image } : {}),
          plats: plats?.[r.slug] ?? [],
          ouvert: !stop && !fermes.has(r.slug) && (maintenant ? estOuvert(horaires, maintenant) : true),
          libelle: stop ?? (fermes.has(r.slug) ? t('Indisponible') : maintenant ? libelleHoraire(horaires, maintenant, t) : ''),
          promo: etiquettePromo(promosVigueur, r.slug, t('dès'), t('Plats en promo'))?.texte ?? null,
        };
      });
    return [...customRows, ...statiquesFiltres];
  }, [statiques, liveRestos, typeCommerce, maintenant, plats, stop, t, promosVigueur, fermes]);
  const [cuisine, setCuisine] = useState<string | null>(null);
  const [ouvertsSeulement, setOuvertsSeulement] = useState(false);
  const [promosSeulement, setPromosSeulement] = useState(false);
  const [nb, setNb] = useState(PAGE);

  const filtres = useMemo(() => {
    let r = rechercher(restos, requete);
    if (cuisine) r = r.filter((x) => correspond(x, cuisine));
    if (ouvertsSeulement) r = r.filter((x) => x.ouvert);
    if (promosSeulement) r = r.filter((x) => x.promo);
    // ouverts d'abord, et parmi eux les restos en promo, sans casser l'ordre de pertinence / popularité
    const rang = (x: CarteResto) => (x.ouvert ? 2 : 0) + (x.promo ? 1 : 0);
    return [...r].sort((a, b) => rang(b) - rang(a));
  }, [restos, requete, cuisine, ouvertsSeulement, promosSeulement]);

  const filtreActif = Boolean(requete.trim() || cuisine || ouvertsSeulement || promosSeulement);
  const enPromo = useMemo(() => restos.filter((r) => r.promo).sort((a, b) => Number(b.ouvert) - Number(a.ouvert)).slice(0, 8), [restos]);
  const populaires = useMemo(() => restos.filter((r) => r.ouvert).slice(0, 6), [restos]);
  const mieuxNotes = useMemo(
    () => restos.filter((r) => r.note >= 4 && r.nbAvis >= 20).sort((a, b) => b.note - a.note || b.nbAvis - a.nbAvis).slice(0, 6),
    [restos],
  );
  const nbOuverts = restos.filter((r) => r.ouvert).length;

  const changer = (f: () => void) => {
    f();
    setNb(PAGE);
  };

  return (
    <div className="flex flex-col gap-10 py-6 sm:gap-14 sm:py-8">
      <div className="sticky top-0 z-20 -mx-4 flex flex-col gap-2 bg-white px-4 pb-2 pt-[calc(0.5rem+env(safe-area-inset-top))] shadow-[0_1px_0_rgba(22,33,63,.08)] sm:static sm:mx-0 sm:rounded-3xl sm:px-6 sm:py-5">
        <div className="hidden items-center justify-between gap-3 sm:flex">
          <h1 className="m-0 text-[22px] font-extrabold tracking-tight sm:text-3xl">{t(titre)}</h1>
          <span className="rounded-full bg-[#e6f6ec] px-2.5 py-1 text-[13px] font-bold text-[#14753d]">
            {maintenant && !stop ? t('{n} ouverts', { n: nbOuverts }) : t('{n} à {ville}', { n: restos.length, ville: livreur.ville })}
          </span>
        </div>
        <label className="flex h-11 items-center gap-2.5 rounded-2xl sm:h-[52px] bg-[#f1f3f9] ps-3.5 pe-1 focus-within:ring-2 focus-within:ring-primary">
          <span aria-hidden className="text-lg text-muted">⌕</span>
          <span className="sr-only">{t('Rechercher un restaurant ou un plat')}</span>
          <input
            type="search"
            value={q}
            onChange={(e) => changer(() => setQ(e.target.value))}
            placeholder={t('Nom du resto ou plat (pizza, tacos…)')}
            className="h-full min-w-0 flex-1 bg-transparent text-[15px] font-medium outline-none placeholder:text-gray-600 [&::-webkit-search-cancel-button]:hidden"
          />
          {q && (
            <button type="button" aria-label={t('Effacer la recherche')} onClick={() => changer(() => setQ(''))} className="grid h-11 w-11 place-items-center text-muted">
              ✕
            </button>
          )}
        </label>
        <div className="no-scrollbar -me-4 flex gap-2 overflow-x-auto pe-4">
          <button
            type="button"
            aria-pressed={ouvertsSeulement}
            onClick={() => changer(() => setOuvertsSeulement((v) => !v))}
            className={`flex h-11 shrink-0 items-center gap-2 rounded-full border px-3.5 text-sm font-bold ${ouvertsSeulement ? 'border-primary bg-primary text-white' : 'border-[#d6dbe8] bg-white'}`}
          >
            <span aria-hidden className={`h-2.5 w-2.5 rounded-full ${ouvertsSeulement ? 'bg-white' : 'bg-green-500'}`} /> {t('Ouverts')}
          </button>
          {enPromo.length > 0 && (
            <button
              type="button"
              aria-pressed={promosSeulement}
              onClick={() => changer(() => setPromosSeulement((v) => !v))}
              className={`flex h-11 shrink-0 items-center gap-2 rounded-full border px-3.5 text-sm font-bold ${promosSeulement ? 'border-[#d6336c] bg-[#d6336c] text-white' : 'border-[#f3b6cb] bg-[#fde7ef] text-[#b0124d]'}`}
            >
              🏷️ {t('Promos')}
            </button>
          )}
          {cuisines.map((c) => {
            const actif = cuisine === c.nom;
            return (
              <button
                key={c.nom}
                type="button"
                aria-pressed={actif}
                onClick={() => changer(() => setCuisine(actif ? null : c.nom))}
                className={`flex h-11 shrink-0 items-center rounded-full border px-4 text-sm font-bold ${actif ? 'border-primary bg-primary text-white' : 'border-[#d6dbe8] bg-white'}`}
              >
                {c.nom}
              </button>
            );
          })}
        </div>
      </div>

      {filtreActif ? (
        <Section titre={`${t(filtres.length > 1 ? '{n} résultats' : '{n} résultat', { n: filtres.length })}${requete.trim() ? t(' pour « {q} »', { q: requete.trim() }) : ''}`}>
          {filtres.length ? (
            <Liste restos={filtres} requete={requete} nb={nb} plus={() => setNb((n) => n + PAGE)} />
          ) : (
            <p className="rounded-[20px] bg-white p-8 text-center text-muted">{t('Aucun restaurant ne correspond. Essayez un autre mot.')}</p>
          )}
        </Section>
      ) : (
        <>
          {enPromo.length > 0 && (
            <Section titre={`🏷️ ${t('En promo')}`}>
              <Tuiles restos={enPromo} />
            </Section>
          )}
          {populaires.length > 0 && (
            <Section titre={t('Populaires en ce moment')}>
              <Tuiles restos={populaires} />
            </Section>
          )}
          {mieuxNotes.length > 0 && (
            <Section titre={t('Les mieux notés')}>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-4">
                {mieuxNotes.map((r) => (
                  <RestoRow key={r.slug} r={r} />
                ))}
              </div>
            </Section>
          )}
          <Section titre={t('Tous les restaurants ({n})', { n: restos.length })}>
            <Grille restos={filtres} nb={nb} plus={() => setNb((n) => n + PAGE)} />
          </Section>
        </>
      )}
    </div>
  );
}

/** Résultats de recherche : liste, avec le plat qui correspond quand ce n'est pas le nom du resto. */
function Liste({ restos, requete, nb, plus }: { restos: CarteResto[]; requete: string; nb: number; plus: () => void }) {
  const n = normaliser(requete);
  const plat = (r: CarteResto) => (n && !normaliser(r.nom).includes(n) ? (r.plats.find((p) => normaliser(p).includes(n)) ?? null) : null);
  return (
    <>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-4">
        {restos.slice(0, nb).map((r) => (
          <RestoRow key={r.slug} r={r} plat={plat(r)} />
        ))}
      </div>
      {nb < restos.length && <Suite reste={restos.length - nb} plus={plus} />}
    </>
  );
}

function Grille({ restos, nb, plus }: { restos: CarteResto[]; nb: number; plus: () => void }) {
  return (
    <>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {restos.slice(0, nb).map((r) => (
          <RestoTile key={r.slug} r={r} />
        ))}
      </div>
      {nb < restos.length && <Suite reste={restos.length - nb} plus={plus} />}
    </>
  );
}
