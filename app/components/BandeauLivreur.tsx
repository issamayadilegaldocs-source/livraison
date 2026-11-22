'use client';
// Grand bandeau en haut de toutes les pages quand le livreur ne prend pas de commandes : pause (avec l'heure
// de retour qu'il a annoncée) ou en dehors de ses horaires. Réglages : page de config du livreur (/api/etat).
import { useT } from '@/lib/i18n';
import { useMaintenant } from '@/lib/maintenant';
import { useReglages } from '@/lib/reglages';
import { arret, type Service } from '@/lib/service';

export default function BandeauLivreur({ service }: { service?: Service }) {
  const m = useMaintenant();
  const r = useReglages();
  const t = useT();
  const a = m ? arret(r ? (r.service ?? undefined) : service, r?.pause ?? false, m, r?.retour ?? undefined, t) : null;
  if (!a) return null;
  return (
    <div role="status" className="bg-red-700 text-white">
      <div className="mx-auto flex max-w-6xl items-center gap-3 py-4 pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))]">
        <span aria-hidden className="text-3xl leading-none">{r?.pause ? '⏸' : '🌙'}</span>
        <div className="min-w-0">
          <p className="m-0 text-lg font-extrabold leading-tight sm:text-xl">
            {a.titre}
            {a.retour && <span className="block text-base font-bold sm:inline sm:text-xl"> · {a.retour}</span>}
          </p>
          <p className="m-0 mt-0.5 text-sm text-white/90">{t('Les commandes sont suspendues. Vous pouvez consulter les menus.')}</p>
        </div>
      </div>
    </div>
  );
}
