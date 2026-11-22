'use client';

import { useEffect, useRef, useState } from 'react';
import { formaterPrix } from '@/lib/commande';
import { useT } from '@/lib/i18n';
import { prixUnitaire, validerChoix, type Choix } from '@/lib/options';
import { useRetour } from '@/lib/retour';
import Img from '../../components/Img';
import type { PlatVue } from './Menu';

type Props = {
  plat: PlatVue | null;
  ouvert: boolean;
  onClose: () => void;
  onAjouter: (platId: number, choix: Choix, qte: number) => void;
};

export default function PlatModal({ plat, ouvert, onClose, onAjouter }: Props) {
  const t = useT();
  const ref = useRef<HTMLDialogElement>(null);
  const [choix, setChoix] = useState<Choix>({});
  const [qte, setQte] = useState(1);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (plat) {
      setChoix({});
      setQte(1);
      if (!d.open) d.showModal();
    } else if (d.open) d.close();
  }, [plat]);

  // Retour du téléphone : ferme la fiche (le navigateur peut aussi fermer le <dialog> lui-même, sans souci).
  useRetour(plat !== null, () => {
    ref.current?.close();
    return false;
  });

  if (!plat) return <dialog ref={ref} onClose={onClose} />;

  const basculer = (g: number, o: number) =>
    setChoix((prev) => {
      const groupe = plat.groupes[g];
      const sel = prev[g] ?? [];
      if (groupe.type === 'single') return { ...prev, [g]: sel[0] === o && !groupe.obligatoire ? [] : [o] };
      if (sel.includes(o)) return { ...prev, [g]: sel.filter((x) => x !== o) };
      return sel.length >= groupe.max ? prev : { ...prev, [g]: [...sel, o] };
    });

  const erreur = validerChoix(plat, choix, t);
  const total = (Math.round(prixUnitaire(plat, choix) * 1000) * qte) / 1000;

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === e.currentTarget && ref.current?.close()}
      aria-labelledby="plat-titre"
      className="mx-auto mb-0 mt-auto max-h-[92dvh] w-full max-w-none overflow-hidden rounded-t-[24px] bg-white p-0 text-ink shadow-2xl sm:m-auto sm:w-[min(560px,calc(100vw-24px))] sm:rounded-[24px]"
    >
      <div className="relative flex max-h-[92dvh] flex-col">
        <button
          type="button"
          onClick={() => ref.current?.close()}
          aria-label={t('Fermer')}
          className="absolute end-3 top-3 z-10 grid h-11 w-11 place-items-center rounded-full bg-white text-lg font-bold shadow-md"
        >
          ✕
        </button>
        <div className="overflow-y-auto">
          {plat.full && <Img src={plat.full} alt="" initiale={plat.nom} className="aspect-[16/10] w-full text-6xl" />}
          <div className="flex flex-col gap-2 p-5">
            <div className="flex items-start justify-between gap-3">
              <h2 id="plat-titre" className="m-0 pe-12 text-2xl font-extrabold">
                {plat.nom}
              </h2>
            </div>
            {plat.description && <p className="m-0 text-sm text-muted">{plat.description}</p>}
            <p className="m-0 flex items-baseline gap-2 font-bold">
              {formaterPrix(plat.prix)}
              {plat.prixOrigine && <s className="text-sm font-medium text-muted">{formaterPrix(plat.prixOrigine)}</s>}
            </p>
          </div>

          {plat.groupes.map((g, gi) => (
            <fieldset key={gi} className="border-t border-black/5 px-5 py-4">
              <legend className="contents">
                <span className="flex items-center justify-between gap-2">
                  <span className="font-bold">{g.nom}</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${g.obligatoire ? 'bg-ink text-white' : 'bg-cream text-muted'}`}>
                    {g.obligatoire ? t('Obligatoire') : t('Facultatif')}
                    {g.type === 'multi' && t(' · max {n}', { n: g.max })}
                  </span>
                </span>
              </legend>
              <ul className="mt-2 flex flex-col">
                {g.options.map((o, oi) => {
                  const coche = (choix[gi] ?? []).includes(oi);
                  return (
                    <li key={oi}>
                      <label className="flex min-h-11 cursor-pointer items-center gap-3 py-2">
                        <input
                          type={g.type === 'single' ? 'radio' : 'checkbox'}
                          name={`g${gi}`}
                          checked={coche}
                          onChange={() => basculer(gi, oi)}
                          className="h-5 w-5 accent-[var(--couleur)]"
                        />
                        <span className="flex-1 text-sm">{o.label}</span>
                        {o.prix > 0 && <span className="text-sm font-semibold text-muted">+{formaterPrix(o.prix)}</span>}
                      </label>
                    </li>
                  );
                })}
              </ul>
            </fieldset>
          ))}
        </div>

        <div className="flex items-center gap-3 border-t border-black/5 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setQte((n) => Math.max(1, n - 1))} aria-label={t('Diminuer la quantité')} className="h-11 w-11 rounded-full border border-black/10 text-lg font-bold">
              −
            </button>
            <span className="w-6 text-center font-bold" aria-live="polite">
              {qte}
            </span>
            <button type="button" onClick={() => setQte((n) => Math.min(50, n + 1))} aria-label={t('Augmenter la quantité')} className="h-11 w-11 rounded-full border border-black/10 text-lg font-bold">
              +
            </button>
          </div>
          {ouvert ? (
            <button
              type="button"
              disabled={Boolean(erreur)}
              title={erreur ?? undefined}
              onClick={() => {
                onAjouter(plat.id, choix, qte);
                ref.current?.close();
              }}
              className="flex h-12 flex-1 items-center justify-between rounded-full bg-primary px-5 font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              <span>{erreur ? erreur : t('Ajouter')}</span>
              <span>{formaterPrix(total)}</span>
            </button>
          ) : (
            <p className="flex h-12 flex-1 items-center justify-center rounded-full bg-cream text-sm font-bold text-muted">{t('Restaurant fermé')}</p>
          )}
        </div>
      </div>
    </dialog>
  );
}
