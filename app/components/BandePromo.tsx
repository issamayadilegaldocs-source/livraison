'use client';
// Bande bien visible en haut du site : livraison gratuite et promos générales du livreur, en clair. Réglages : page de
// config du livreur (/api/etat) ; avant sa réponse, ceux du build (livreur.json).
import { etiquettePromo, type PromoVue } from '@/lib/commission';
import { useT } from '@/lib/i18n';
import { texteLivraisonGratuite, type LivraisonGratuite } from '@/lib/livraison-gratuite';
import { useReglages } from '@/lib/reglages';
import { supplementEnCours } from '@/lib/regles-livreur';

export default function BandePromo({ livraisonGratuite, promos }: { livraisonGratuite: LivraisonGratuite | null; promos: PromoVue[] }) {
  const t = useT();
  const r = useReglages();
  const gratuite = r ? r.livraisonGratuite : livraisonGratuite;
  // Promos valables partout (ni resto ni plat précis) ; les autres sont annoncées sur les restos concernés.
  const generales = (r ? r.promos : promos).filter((p) => !p.resto && p.plat === undefined);
  const promo = generales.length ? etiquettePromo(generales, '', t('dès')) : null;
  const annonce = r?.annonce ?? null;
  const sup = !gratuite && r ? supplementEnCours(r.supplement, new Date(), t('Nuit')) : null;
  if (!gratuite && !promo && !annonce && !sup) return null;
  return (
    <div role="status" className="bg-gradient-to-r from-[#d6336c] to-[#e8590c] text-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-6 gap-y-1 py-2.5 pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] text-center text-[15px] font-extrabold sm:text-base">
        {annonce && <span>📢 {annonce}</span>}
        {gratuite && <span>🛵 {texteLivraisonGratuite(gratuite, { gratuite: t('Livraison gratuite'), des: t('dès') })}</span>}
        {sup && (
          <span>
            🌧️ {sup.libelle} : +{String(sup.montant).replace('.', ',')} DT {t('sur la livraison')}
          </span>
        )}
        {promo && (
          <span>
            🏷️ {promo.nom} : {promo.texte}
          </span>
        )}
      </div>
    </div>
  );
}
