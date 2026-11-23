'use client';

import { LogoLivreur } from '@/lib/logo';
import { useReglages } from '@/lib/reglages';

export default function LogoDynamique({
  logoDefaut,
  couleur,
}: {
  logoDefaut?: string;
  couleur: string;
}) {
  const r = useReglages();
  const src = r && r.logoUrl !== undefined ? r.logoUrl : (logoDefaut ?? null);
  if (src) {
    return <img src={src} alt="" className="h-9 w-9 shrink-0 rounded-xl object-cover" />;
  }
  return (
    <span className="shrink-0">
      <LogoLivreur couleur={couleur} taille={36} />
    </span>
  );
}
