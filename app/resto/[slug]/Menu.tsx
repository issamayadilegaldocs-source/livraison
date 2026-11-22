'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { Plat } from '@/lib/catalogue';
import { formaterPrix } from '@/lib/commande';
import { useT } from '@/lib/i18n';
import { prixUnitaire, validerChoix, type Choix } from '@/lib/options';
import { normaliser } from '@/lib/recherche';
import { etiquettePlat, etiquettePromo, type PromoVue } from '@/lib/commission';
import type { FraisService } from '@/lib/frais-service';
import type { LivraisonGratuite } from '@/lib/livraison-gratuite';
import type { ConfLivraison, Point } from '@/lib/livraison';
import Img from '../../components/Img';
import Panier, { type LignePanier, type ReglesClient } from './Panier';
import PlatModal from './PlatModal';

export type PlatVue = Plat & { thumb: string | null; full: string | null };

type Props = {
  slug: string;
  nomResto: string;
  ouvert: boolean;
  libelle: string;
  /** Livreur hors service ou en pause : remplace le message « resto fermé ». */
  messageFerme?: string | null;
  categories: { id: number; nom: string }[];
  plats: PlatVue[];
  livraison: ConfLivraison;
  fraisService: FraisService | null;
  livraisonGratuite: LivraisonGratuite | null;
  regles: ReglesClient;
  promos: PromoVue[];
  restoPosition: Point;
};

const cleLigne = (platId: number, choix: Choix) =>
  `${platId}:${Object.keys(choix)
    .sort()
    .map((k) => `${k}=${[...choix[Number(k)]].sort((a, b) => a - b).join(',')}`)
    .join(';')}`;

function lirePanier(cle: string, plats: PlatVue[]): LignePanier[] {
  try {
    const brut = JSON.parse(localStorage.getItem(cle) ?? '[]') as LignePanier[];
    // on jette les lignes devenues invalides (plat retiré, options changées depuis l'import)
    return brut.filter((l) => {
      const p = plats.find((x) => x.id === l.platId);
      return p && l.qte > 0 && !validerChoix(p, l.choix);
    });
  } catch {
    return [];
  }
}

export default function Menu({ slug, nomResto, ouvert, libelle, messageFerme, categories, plats, livraison, fraisService, livraisonGratuite, regles, promos, restoPosition }: Props) {
  const t = useT();
  const promoResto = etiquettePromo(promos, slug, t('dès'), t('Plats en promo'));
  const clePanier = `panier:${slug}`;
  const [panier, setPanier] = useState<LignePanier[]>([]);
  const [q, setQ] = useState('');
  const [ouvertId, setOuvertId] = useState<number | null>(null);
  const [actif, setActif] = useState(categories[0]?.id);
  const refs = useRef(new Map<number, HTMLElement>());

  useEffect(() => setPanier(lirePanier(clePanier, plats)), [clePanier, plats]);

  // « Refaire ma dernière commande » : lignes gardées à l'envoi (Panier.tsx), proposées tant que le panier est vide.
  const cleDerniere = `derniere-commande:${slug}`;
  const [derniere, setDerniere] = useState<LignePanier[]>([]);
  useEffect(() => setDerniere(lirePanier(cleDerniere, plats)), [cleDerniere, plats]);

  const maj = (f: (l: LignePanier[]) => LignePanier[]) =>
    setPanier((prev) => {
      const next = f(prev).filter((l) => l.qte > 0);
      try {
        localStorage.setItem(clePanier, JSON.stringify(next));
      } catch {
        /* stockage indisponible : panier en mémoire */
      }
      return next;
    });

  const ajouter = (platId: number, choix: Choix, qte: number) => {
    const cle = cleLigne(platId, choix);
    maj((prev) =>
      prev.some((l) => l.cle === cle)
        ? prev.map((l) => (l.cle === cle ? { ...l, qte: Math.min(50, l.qte + qte) } : l))
        : [...prev, { cle, platId, choix, qte }],
    );
    // Retour visible (et une courte vibration sur Android ; iOS l'ignore) : sinon l'ajout passe inaperçu.
    setAjoute({ nom: plats.find((p) => p.id === platId)?.nom ?? '', qte, n: Date.now() });
    navigator.vibrate?.(30);
  };

  const [ajoute, setAjoute] = useState<{ nom: string; qte: number; n: number } | null>(null);
  useEffect(() => {
    if (!ajoute) return;
    const t = setTimeout(() => setAjoute(null), 1800);
    return () => clearTimeout(t);
  }, [ajoute]);

  const visibles = useMemo(() => {
    const n = normaliser(q);
    return n ? plats.filter((p) => normaliser(`${p.nom} ${p.description}`).includes(n)) : plats;
  }, [plats, q]);

  // onglet actif = catégorie visible en haut de l'écran
  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        const vu = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (vu) setActif(Number((vu.target as HTMLElement).dataset.cat));
      },
      { rootMargin: '-185px 0px -60% 0px' },
    );
    refs.current.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, [visibles]);

  const platOuvert = plats.find((p) => p.id === ouvertId) ?? null;
  const sousTotal =
    panier.reduce((s, l) => {
      const p = plats.find((x) => x.id === l.platId);
      return p ? s + Math.round(prixUnitaire(p, l.choix) * 1000) * l.qte : s;
    }, 0) / 1000;

  return (
    <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_380px]">
      <div className="min-w-0">
        <div className="sticky top-[var(--entete)] z-20 transition-[top] duration-200 -mx-4 border-b border-black/5 bg-cream/95 px-4 pb-2 pt-3 backdrop-blur">
          <label className="flex h-11 items-center gap-2 rounded-xl border border-black/10 bg-white px-3">
            <span aria-hidden className="text-muted">⌕</span>
            <span className="sr-only">{t('Rechercher dans le menu')}</span>
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t('Rechercher chez {nom}', { nom: nomResto })}
              className="h-full min-w-0 flex-1 bg-transparent outline-none"
            />
          </label>
          {!q && (
            <nav aria-label={t('Catégories')} className="no-scrollbar mt-2 flex gap-2 overflow-x-auto">
              {categories.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => refs.current.get(c.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                  className={`h-11 shrink-0 rounded-full px-4 text-sm font-semibold ${actif === c.id ? 'bg-ink text-white' : 'bg-white text-ink'}`}
                >
                  {c.nom}
                </button>
              ))}
            </nav>
          )}
        </div>

        {promoResto && (
          <p className="mt-4 rounded-2xl bg-[#fde7ef] p-4 text-sm font-bold text-[#b0124d]">
            🏷️ {promoResto.nom} : {promoResto.texte} <span className="font-medium">{promoResto.texte === t('Plats en promo') ? t('repérez le badge sur les plats') : t('sur votre commande, calculé dans le panier')}</span>
          </p>
        )}

        {panier.length === 0 && derniere.length > 0 && ouvert && (
          <button
            type="button"
            onClick={() => maj(() => derniere)}
            className="mt-4 flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl border border-primary/30 bg-white px-4 py-2 text-sm font-bold text-primary"
          >
            ↻ {t('Refaire ma dernière commande ({n} articles)', { n: derniere.reduce((n, l) => n + l.qte, 0) })}
          </button>
        )}

        {/* Livreur en pause ou hors service : le grand bandeau en haut de page l'annonce déjà. */}
        {!ouvert && !messageFerme && (
          <p role="status" className="mt-4 rounded-2xl bg-red-50 p-4 text-sm font-semibold text-red-800">
            {messageFerme ?? t('{nom} est fermé pour le moment ({l}). Vous pouvez consulter le menu.', { nom: nomResto, l: libelle })}
          </p>
        )}

        {visibles.length === 0 && <p className="mt-6 rounded-[20px] bg-white p-8 text-center text-muted">{t('Aucun plat ne correspond.')}</p>}

        {categories.map((c) => {
          const ps = visibles.filter((p) => p.categorieId === c.id);
          if (!ps.length) return null;
          return (
            <section
              key={c.id}
              data-cat={c.id}
              ref={(el) => {
                if (el) refs.current.set(c.id, el);
                else refs.current.delete(c.id);
              }}
              className="scroll-mt-48 pt-6"
            >
              <h2 className="mb-3 text-xl font-extrabold">{c.nom}</h2>
              <ul className="grid gap-3 md:grid-cols-2">
                {ps.map((p) => {
                  // Plat sans option : ajout direct d'un toucher, sans ouvrir la fiche.
                  const rapide = ouvert && p.groupes.length === 0;
                  return (
                  <li key={p.id} className="relative">
                    <button
                      type="button"
                      onClick={() => setOuvertId(p.id)}
                      className={`flex h-full w-full items-start gap-3 rounded-[20px] border border-black/5 bg-white p-3 text-start transition hover:shadow-md ${rapide && !p.thumb ? 'pe-14' : ''}`}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2 font-bold">
                          {p.nom}
                          {p.populaire && <span className="rounded-full bg-saffron px-2 py-0.5 text-[11px] font-bold text-ink">{t('Populaire')}</span>}
                          {etiquettePlat(promos, slug, p.id, t('dès')) && <span className="rounded-full bg-[#fde7ef] px-2 py-0.5 text-[11px] font-extrabold text-[#b0124d]">🏷️ {etiquettePlat(promos, slug, p.id, t('dès'))!.texte}</span>}
                        </span>
                        {p.description && <span className="mt-1 line-clamp-2 block text-sm text-muted">{p.description}</span>}
                        <span className="mt-2 flex items-baseline gap-2 text-sm font-bold">
                          {formaterPrix(p.prix)}
                          {p.prixOrigine && <s className="font-medium text-muted">{formaterPrix(p.prixOrigine)}</s>}
                        </span>
                      </span>
                      {p.thumb && <Img src={p.thumb} alt="" initiale={p.nom} className="h-24 w-24 shrink-0 rounded-2xl text-xl" />}
                    </button>
                    {rapide && (
                      <button
                        type="button"
                        onClick={() => ajouter(p.id, {}, 1)}
                        aria-label={t('Ajouter {nom} au panier', { nom: p.nom })}
                        className="absolute bottom-2 end-2 grid h-11 w-11 place-items-center rounded-full border border-black/5 bg-white text-2xl font-bold text-primary shadow-md active:scale-95"
                      >
                        +
                      </button>
                    )}
                  </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>

      <Panier
        nomResto={nomResto}
        slug={slug}
        ouvert={ouvert}
        libelle={libelle}
        messageFerme={messageFerme}
        plats={plats}
        lignes={panier}
        livraison={livraison}
        fraisService={fraisService}
        livraisonGratuite={livraisonGratuite}
        regles={regles}
        promos={promos}
        restoPosition={restoPosition}
        sousTotal={sousTotal}
        changerQte={(cle, delta) => maj((prev) => prev.map((l) => (l.cle === cle ? { ...l, qte: Math.min(50, l.qte + delta) } : l)))}
        vider={() => maj(() => [])}
      />

      {ajoute && (
        <p
          key={ajoute.n}
          role="status"
          className="pointer-events-none fixed inset-x-0 bottom-[calc(max(1rem,env(safe-area-inset-bottom))+4.25rem)] z-40 mx-auto w-max max-w-[calc(100vw-2rem)] truncate rounded-full bg-ink px-4 py-2.5 text-sm font-bold text-white shadow-lg lg:bottom-6"
        >
          ✓ {t('Ajouté au panier :')} {ajoute.qte > 1 ? `${ajoute.qte} × ` : ''}{ajoute.nom}
        </p>
      )}

      <PlatModal plat={platOuvert} ouvert={ouvert} onClose={() => setOuvertId(null)} onAjouter={ajouter} />
    </div>
  );
}
