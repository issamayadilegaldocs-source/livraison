'use client';
// Réglages du livreur vus par le navigateur : GET /api/etat, dédupliqué et gardé 3 min en mémoire + sessionStorage.
import { useEffect, useState } from 'react';
import { fetchCache, lireCacheSync } from './cache-client';
import type { Correction, Regle } from './config';
import type { PromoVue } from './commission';
import type { Supplement } from './regles-livreur';
import type { TarifColis } from './colis';
import type { FraisService } from './frais-service';
import type { LivraisonGratuite } from './livraison-gratuite';
import type { ConfLivraison } from './livraison';
import type { Service } from './service';

export type Reglages = { pause: boolean; retour: string | null; service: Service | null; livraison: ConfLivraison; fraisService: FraisService | null; livraisonGratuite: LivraisonGratuite | null; colis: TarifColis; restosFermes: string[]; commandeMin: number | null; supplement: Supplement | null; annonce: string | null; pourboires: number[]; promos: PromoVue[]; plats: Record<string, Correction>; logoUrl?: string | null; nomSite?: string | null; majorationResto?: Regle | null; parrainage?: { actif: boolean; montantParrain: number; montantFilleul: number }; paiements?: { especes: boolean; flouciD17: boolean; carteTpe: boolean; numeroD17?: string }; reseaux?: { facebook?: string; instagram?: string; tiktok?: string } | null };

const DUREE_CACHE = 3 * 60_000;

/**
 * Une seule requête dédupliquée par tranche de 3 min (partagée entre en-tête, logo, réseaux sociaux, bandeau et pages).
 */
export function useReglages(resto?: string): Reglages | null {
  const url = `/api/etat${resto ? `?resto=${encodeURIComponent(resto)}` : ''}`;
  const [r, setR] = useState<Reglages | null>(() => lireCacheSync<Reglages>(url, DUREE_CACHE));

  useEffect(() => {
    let actif = true;
    const hit = lireCacheSync<Reglages>(url, DUREE_CACHE);
    if (hit) {
      setR(hit);
      return;
    }
    fetchCache<Reglages>(url, { ttlMs: DUREE_CACHE }).then((e) => {
      if (actif && e && typeof e.pause === 'boolean') setR(e);
    });
    return () => {
      actif = false;
    };
  }, [url]);

  return r;
}
