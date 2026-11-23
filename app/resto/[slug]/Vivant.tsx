'use client';
// Le HTML est construit au build : ouvert/fermé et les réglages du livreur (pause, horaires, frais, prix
// corrigés) s'appliquent dans le navigateur.
import { useEffect, useMemo, useState, type ComponentProps } from 'react';
import type { Horaire } from '@/lib/catalogue';
import { corrigerPlats, majorer } from '@/lib/config';
import { estOuvert, libelleHoraire } from '@/lib/horaires';
import { useT } from '@/lib/i18n';
import { useMaintenant } from '@/lib/maintenant';
import { useReglages } from '@/lib/reglages';
import { messageArret, type Service } from '@/lib/service';
import type { RestaurantGestion } from '@/lib/plateforme';
import Menu, { type PlatVue } from './Menu';

export function StatutResto({ horaires }: { horaires: Horaire[] }) {
  const t = useT();
  const m = useMaintenant();
  if (!m) return null;
  return <span className={estOuvert(horaires, m) ? 'text-green-700' : 'text-red-700'}>{libelleHoraire(horaires, m, t)}</span>;
}

type PropsMenu = Omit<ComponentProps<typeof Menu>, 'ouvert' | 'libelle' | 'messageFerme' | 'categories' | 'plats'> & { horaires: Horaire[]; service?: Service };

/**
 * Menu avec l'état courant : resto ouvert, livreur en service et pas en pause, frais et prix du livreur.
 * Avant l'hydratation et la réponse de /api/etat : réglages du build, ouvert, sans bandeau.
 */
export function MenuVivant({ horaires, service, livraison, fraisService, livraisonGratuite, regles, promos, slug, ...props }: PropsMenu) {
  const t = useT();
  const m = useMaintenant();
  const r = useReglages(slug);
  const [gestion, setGestion] = useState<RestaurantGestion | null>(null);
  const serviceEnVigueur = r ? (r.service ?? undefined) : service;
  const restoFerme = (r?.restosFermes.includes(slug) ?? false) || gestion?.actif === false;
  const arret = restoFerme ? t('Ce restaurant est indisponible pour le moment.') : m ? messageArret(serviceEnVigueur, r?.pause ?? false, m, r?.retour ?? undefined, t) : null;
  // Menu : JSON statique /menu-data/<slug> (hors du HTML pour l'alléger) + surcharges live admin.
  const [menu, setMenu] = useState<{ categories: { id: number; nom: string }[]; plats: PlatVue[] } | null>(null);
  const [erreur, setErreur] = useState(false);
  useEffect(() => {
    setErreur(false);
    fetch(`/menu-data/${slug}`)
      .then((x) => (x.ok ? x.json() : Promise.reject()))
      .then(setMenu, () => setErreur(true));
    fetch(`/api/restos-live?slug=${encodeURIComponent(slug)}`)
      .then((x) => (x.ok ? x.json() : null))
      .then((d) => d?.restaurant && setGestion(d.restaurant))
      .catch(() => {});
  }, [slug]);
  const { categoriesVues, platsVus } = useMemo(() => {
    if (!menu) return { categoriesVues: [] as { id: number; nom: string }[], platsVus: [] as PlatVue[] };
    const categories = [...menu.categories];
    let nextCatId = categories.reduce((mx, c) => Math.max(mx, c.id), 0) + 1;
    const assurerCat = (nom: string) => {
      const ex = categories.find((c) => c.nom.toLowerCase() === nom.toLowerCase());
      if (ex) return ex.id;
      const id = nextCatId++;
      categories.push({ id, nom });
      return id;
    };
    const modifs = gestion?.plats_overrides?.modifs ?? {};
    const ajouts = gestion?.plats_overrides?.ajouts ?? [];
    const basePlats: PlatVue[] = [];
    for (const p of menu.plats) {
      const ov = modifs[String(p.id)];
      if (ov?.indispo) continue;
      basePlats.push({
        ...p,
        ...(ov?.nom ? { nom: ov.nom } : {}),
        ...(typeof ov?.prix === 'number' ? { prix: ov.prix } : {}),
        ...(ov?.description !== undefined ? { description: ov.description } : {}),
        ...(ov?.categorie ? { categorieId: assurerCat(ov.categorie) } : {}),
      });
    }
    for (const a of ajouts) {
      if (a.indispo) continue;
      basePlats.push({
        id: a.id,
        categorieId: assurerCat(a.categorie || 'Nouveautés'),
        nom: a.nom,
        description: a.description ?? '',
        prix: a.prix,
        prixOrigine: null,
        populaire: false,
        image: a.image ?? null,
        thumb: a.image ?? null,
        full: a.image ?? null,
        groupes: [],
      });
    }
    const maj = r?.majorationResto ?? null;
    const majores: PlatVue[] = maj
      ? basePlats.map((p) => {
          if ('montant' in maj) {
            return { ...p, prix: Math.round((p.prix + maj.montant) * 1000) / 1000 };
          }
          return {
            ...p,
            prix: majorer(p.prix, maj.pourcent),
            groupes: p.groupes.map((g) => ({
              ...g,
              options: g.options.map((o) => ({ ...o, prix: o.prix > 0 ? majorer(o.prix, maj.pourcent) : 0 })),
            })),
          };
        })
      : basePlats;
    return { categoriesVues: categories, platsVus: corrigerPlats(majores, r?.plats) };
  }, [menu, r, gestion]);
  if (!menu)
    return erreur ? (
      <p className="mt-6 text-center text-sm font-semibold text-red-700">{t('Menu indisponible, vérifiez votre connexion et rechargez la page.')}</p>
    ) : (
      <div className="mt-6 flex flex-col gap-3" aria-busy="true">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-24 animate-pulse rounded-2xl bg-white" />
        ))}
      </div>
    );
  return (
    <Menu
      {...props}
      slug={slug}
      categories={categoriesVues}
      plats={platsVus}
      livraison={r?.livraison ?? livraison}
      fraisService={r ? r.fraisService : fraisService}
      livraisonGratuite={r ? r.livraisonGratuite : livraisonGratuite}
      regles={r ? { commandeMin: r.commandeMin, supplement: r.supplement, pourboires: r.pourboires } : regles}
      promos={r ? r.promos : promos}
      ouvert={!arret && (m ? estOuvert(horaires, m) : true)}
      libelle={m ? libelleHoraire(horaires, m, t) : ''}
      messageFerme={arret}
    />
  );
}
