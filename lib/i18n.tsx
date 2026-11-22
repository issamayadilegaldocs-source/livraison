'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AR } from './ar';
import { traducteur, type Tr } from './traduire';

export type Langue = 'fr' | 'ar';
const CLE = 'langue';
const Ctx = createContext<{ langue: Langue; changer: (l: Langue) => void }>({ langue: 'fr', changer: () => {} });

/**
 * Langue du site. Le HTML statique est en français ; le choix du client (localStorage) s'applique après l'hydratation
 * et passe la page en arabe, droite-à-gauche (`<html lang dir>`).
 */
export function LangueProvider({ children }: { children: ReactNode }) {
  const [langue, setLangue] = useState<Langue>('fr');
  useEffect(() => {
    try {
      if (localStorage.getItem(CLE) === 'ar') setLangue('ar');
    } catch {}
  }, []);
  useEffect(() => {
    document.documentElement.lang = langue;
    document.documentElement.dir = langue === 'ar' ? 'rtl' : 'ltr';
  }, [langue]);
  const changer = useCallback((l: Langue) => {
    setLangue(l);
    try {
      localStorage.setItem(CLE, l);
    } catch {}
  }, []);
  const v = useMemo(() => ({ langue, changer }), [langue, changer]);
  return <Ctx.Provider value={v}>{children}</Ctx.Provider>;
}

export const useLangue = () => useContext(Ctx);

/** `t('Votre panier')`, `t('{n} articles', { n })`. */
export function useT(): Tr {
  const { langue } = useContext(Ctx);
  return useMemo(() => traducteur(langue === 'ar' ? AR : null), [langue]);
}

/** Pour les composants serveur : `<T k="Voir les restos" />`. */
export function T({ k, v }: { k: string; v?: Record<string, string | number> }) {
  return <>{useT()(k, v)}</>;
}

/** Bouton FR / عربي de l'en-tête. */
export function ChoixLangue() {
  const { langue, changer } = useLangue();
  const ar = langue === 'ar';
  return (
    <button
      type="button"
      onClick={() => changer(ar ? 'fr' : 'ar')}
      lang={ar ? 'fr' : 'ar'}
      className="flex h-10 shrink-0 items-center rounded-full border border-black/10 bg-white px-3 text-sm font-bold"
    >
      {ar ? 'Français' : 'عربي'}
    </button>
  );
}
