'use client';

import { useT } from '@/lib/i18n';

/** Champ de recherche de l'accueil (envoie vers /c/tout?q=…) : client, pour traduire libellé et indice. */
export default function ChampAccueil() {
  const t = useT();
  return (
    <>
      <label htmlFor="q" className="sr-only">
        {t('Rechercher un resto, un plat ou un commerce')}
      </label>
      <input id="q" name="q" type="search" placeholder={t('Resto, plat, épicerie, pharmacie…')} className="h-full min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-gray-600" />
    </>
  );
}
