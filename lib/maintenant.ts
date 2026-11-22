'use client';
import { useEffect, useState } from 'react';

/**
 * Heure courante côté navigateur, mise à jour chaque minute. `null` pendant le rendu statique et avant
 * l'hydratation : le HTML est construit au build, donc ouvert/fermé ne peut être calculé qu'ici.
 */
export function useMaintenant(): Date | null {
  const [d, setD] = useState<Date | null>(null);
  useEffect(() => {
    setD(new Date());
    const t = setInterval(() => setD(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);
  return d;
}
