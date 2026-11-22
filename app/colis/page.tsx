import type { Metadata } from 'next';
import Link from '@/app/components/Lien';
import { getRestos } from '@/lib/catalogue';
import { tarifColis } from '@/lib/colis';
import { T } from '@/lib/i18n';
import { getLivreur } from '@/lib/livreur';
import FormColis from './FormColis';

export function generateMetadata(): Metadata {
  const l = getLivreur();
  return { title: `Envoyer un colis à ${l.ville} — ${l.nom}` };
}

export default function Colis() {
  const l = getLivreur();
  // Centre de la ville pour la carte : moyenne des restos du dump (pas de coordonnées de ville stockées).
  const restos = getRestos();
  const zone = {
    lat: restos.reduce((s, r) => s + r.position.lat, 0) / restos.length,
    lng: restos.reduce((s, r) => s + r.position.lng, 0) / restos.length,
  };
  return (
    <div className="mx-auto flex max-w-xl flex-col gap-3 py-4">
      <Link href="/" className="text-sm font-semibold text-muted hover:underline">
        <T k="← Accueil" />
      </Link>
      <FormColis zone={zone} tarif={tarifColis(l.livraison, l.colis)} service={l.service} ville={l.ville} whatsapp={l.whatsapp} />
    </div>
  );
}
