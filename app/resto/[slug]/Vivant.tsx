'use client';
// Le HTML est construit au build : ouvert/fermé et les réglages du livreur (pause, horaires, frais, prix
// corrigés) s'appliquent dans le navigateur.
import { useEffect, useMemo, useState, type ComponentProps } from 'react';
import type { Horaire } from '@/lib/catalogue';
import { corrigerPlats } from '@/lib/config';
import { estOuvert, libelleHoraire } from '@/lib/horaires';
import { useT } from '@/lib/i18n';
import { useMaintenant } from '@/lib/maintenant';
import { useReglages } from '@/lib/reglages';
import { messageArret, type Service } from '@/lib/service';
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
  const serviceEnVigueur = r ? (r.service ?? undefined) : service;
  const restoFerme = r?.restosFermes.includes(slug) ?? false;
  const arret = restoFerme ? t('Ce restaurant est indisponible pour le moment.') : m ? messageArret(serviceEnVigueur, r?.pause ?? false, m, r?.retour ?? undefined, t) : null;
  // Menu : JSON statique /menu-data/<slug> (hors du HTML pour l'alléger).
  const [menu, setMenu] = useState<{ categories: { id: number; nom: string }[]; plats: PlatVue[] } | null>(null);
  const [erreur, setErreur] = useState(false);
  useEffect(() => {
    setErreur(false);
    fetch(`/menu-data/${slug}`)
      .then((x) => (x.ok ? x.json() : Promise.reject()))
      .then(setMenu, () => setErreur(true));
  }, [slug]);
  const platsVus = useMemo(() => (menu ? corrigerPlats(menu.plats, r?.plats) : []), [menu, r]);
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
      categories={menu.categories}
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
