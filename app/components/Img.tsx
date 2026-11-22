'use client';

import { useEffect, useRef, useState } from 'react';
import { urlSecours } from '@/lib/media';

/** Image paresseuse ; sans source ou en erreur, affiche l'initiale sur la couleur du livreur. */
export default function Img({ src, alt, initiale, className = '' }: { src: string | null; alt: string; initiale: string; className?: string }) {
  const [ko, setKo] = useState(false);
  const [secours, setSecours] = useState(false); // l'image manque sur un hôte : on essaie l'autre une fois
  const [charge, setCharge] = useState(false);
  const ref = useRef<HTMLImageElement>(null);
  // An SSR <img> can fail before hydration attaches onError: check once mounted.
  useEffect(() => {
    const i = ref.current;
    if (i?.complete) (i.naturalWidth === 0 ? echec() : setCharge(true));
  }, [src]);
  const autre = src ? urlSecours(src) : null;
  const echec = () => (autre && !secours ? setSecours(true) : setKo(true));
  if (!src || ko) {
    return (
      <span aria-hidden={!alt} className={`grid place-items-center bg-primary font-extrabold text-white/90 ${className}`}>
        {initiale.charAt(0).toUpperCase()}
      </span>
    );
  }
  return <img ref={ref} src={secours && autre ? autre : src} alt={alt} loading="lazy" decoding="async" onLoad={() => setCharge(true)} onError={echec} className={`object-cover ${charge ? '' : 'animate-pulse bg-gray-200'} ${className}`} />;
}
