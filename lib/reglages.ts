'use client';
// Réglages du livreur (page de config) vus par le navigateur : GET /api/etat, gardé 2 min dans sessionStorage.
import { useEffect, useState } from 'react';
import type { Correction, Regle } from './config';
import type { PromoVue } from './commission';
import type { Supplement } from './regles-livreur';
import type { TarifColis } from './colis';
import type { FraisService } from './frais-service';
import type { LivraisonGratuite } from './livraison-gratuite';
import type { ConfLivraison } from './livraison';
import type { Service } from './service';

export type Reglages = { pause: boolean; retour: string | null; service: Service | null; livraison: ConfLivraison; fraisService: FraisService | null; livraisonGratuite: LivraisonGratuite | null; colis: TarifColis; restosFermes: string[]; commandeMin: number | null; supplement: Supplement | null; annonce: string | null; pourboires: number[]; promos: PromoVue[]; plats: Record<string, Correction>; logoUrl?: string | null; nomSite?: string | null; majorationResto?: Regle | null; parrainage?: { actif: boolean; montantParrain: number; montantFilleul: number }; paiements?: { especes: boolean; flouciD17: boolean; carteTpe: boolean; numeroD17?: string }; reseaux?: { facebook?: string; instagram?: string; tiktok?: string } | null };

const DUREE_CACHE = 2 * 60_000;

/**
 * Une requête par visiteur, par resto et par tranche de 2 min (pas une par page). null tant que rien n'est connu
 * ou si la requête échoue (dev, hors ligne) : la page garde les réglages du build. La Function revérifie tout.
 */
// ponytail: one Function call per visitor per page type per 2 min; poll less if the shared quota gets tight.
export function useReglages(resto?: string): Reglages | null {
  const [r, setR] = useState<Reglages | null>(null);
  useEffect(() => {
    const cle = `reglages:${resto ?? ''}`;
    try {
      const c = JSON.parse(sessionStorage.getItem(cle) ?? 'null');
      if (c && Date.now() - c.t < DUREE_CACHE) return setR(c.r);
    } catch {
      /* stockage indisponible : on interroge le serveur */
    }
    fetch(`/api/etat${resto ? `?resto=${encodeURIComponent(resto)}` : ''}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((e: Reglages | null) => {
        if (!e || typeof e.pause !== 'boolean') return;
        setR(e);
        try {
          sessionStorage.setItem(cle, JSON.stringify({ t: Date.now(), r: e }));
        } catch {
          /* sans stockage : nouvelle requête à la prochaine page */
        }
      })
      .catch(() => {});
  }, [resto]);
  return r;
}
