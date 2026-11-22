'use client';

import { useEffect, useState } from 'react';
import { useT } from '@/lib/i18n';

/** Bandeau « Pas de connexion » : évite une page qui semble figée quand le réseau tombe. */
export default function BandeauHorsLigne() {
  const t = useT();
  const [hors, setHors] = useState(false);
  useEffect(() => {
    const maj = () => setHors(!navigator.onLine);
    maj();
    window.addEventListener('online', maj);
    window.addEventListener('offline', maj);
    return () => {
      window.removeEventListener('online', maj);
      window.removeEventListener('offline', maj);
    };
  }, []);
  if (!hors) return null;
  return (
    <p role="alert" className="sticky top-0 z-50 m-0 bg-red-700 px-4 pb-2 pt-[calc(0.5rem+env(safe-area-inset-top))] text-center text-sm font-bold text-white">
      {t('Pas de connexion internet. Vérifiez votre réseau : la commande ne peut pas partir.')}
    </p>
  );
}
