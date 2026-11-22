'use client';

import { useEffect, useRef } from 'react';
import 'leaflet/dist/leaflet.css';
import { useT } from '@/lib/i18n';
import type { Point } from '@/lib/livraison';

const PIN =
  '<svg width="34" height="44" viewBox="0 0 34 44" aria-hidden="true"><path d="M17 0C7.6 0 0 7.6 0 17c0 12.7 17 27 17 27s17-14.3 17-27C34 7.6 26.4 0 17 0z" fill="var(--couleur)"/><circle cx="17" cy="17" r="6.5" fill="#fff"/></svg>';

/** Carte figée (récapitulatif) : montre au client où le livreur viendra, pour qu'il le confirme. */
export default function MiniCarte({ point }: { point: Point }) {
  const t = useT();
  const div = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let carte: import('leaflet').Map | null = null;
    let annule = false;
    (async () => {
      const L = (await import('leaflet')).default;
      if (annule || !div.current) return;
      carte = L.map(div.current, {
        zoomControl: false,
        dragging: false,
        scrollWheelZoom: false,
        doubleClickZoom: false,
        touchZoom: false,
        boxZoom: false,
        keyboard: false,
        attributionControl: true,
      }).setView([point.lat, point.lng], 17);
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap' }).addTo(carte);
      L.marker([point.lat, point.lng], { icon: L.divIcon({ html: PIN, className: '', iconSize: [34, 44], iconAnchor: [17, 44] }), keyboard: false }).addTo(carte);
    })();
    return () => {
      annule = true;
      carte?.remove();
    };
  }, [point.lat, point.lng]);
  return <div ref={div} aria-label={t('Carte du point de livraison')} dir="ltr" className="relative isolate z-0 h-44 w-full overflow-hidden rounded-xl border border-black/10" />;
}
