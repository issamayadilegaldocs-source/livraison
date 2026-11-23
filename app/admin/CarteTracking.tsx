'use client';

import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

export type PointTracking = {
  id: string;
  nom: string;
  lat: number;
  lng: number;
  detail?: string;
  at?: string;
};

function ilYa(iso?: string): string {
  if (!iso) return '';
  const sec = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (sec < 60) return `il y a ${sec}s`;
  const min = Math.round(sec / 60);
  if (min < 60) return `il y a ${min} min`;
  return `il y a ${Math.round(min / 60)} h`;
}

export default function CarteTracking({
  points,
  hauteur = 280,
}: {
  points: PointTracking[];
  hauteur?: number;
}) {
  const conteneur = useRef<HTMLDivElement>(null);
  const carte = useRef<L.Map | null>(null);
  const calque = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!conteneur.current || carte.current) return;
    const centre: [number, number] = points[0] ? [points[0].lat, points[0].lng] : [34.7406, 10.7603];
    const m = L.map(conteneur.current, { zoomControl: true }).setView(centre, 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap',
      maxZoom: 19,
    }).addTo(m);
    calque.current = L.layerGroup().addTo(m);
    carte.current = m;
    return () => {
      m.remove();
      carte.current = null;
      calque.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const m = carte.current;
    const g = calque.current;
    if (!m || !g) return;
    g.clearLayers();
    if (!points.length) return;

    const bounds: [number, number][] = [];
    for (const p of points) {
      const icon = L.divIcon({
        className: 'tracking-pin',
        html: `<div style="display:flex;align-items:center;gap:4px;background:#141a2b;color:#fff;padding:4px 9px;border-radius:999px;font-weight:800;font-size:12px;white-space:nowrap;border:2px solid #fff;box-shadow:0 4px 12px rgba(0,0,0,.25)">🛵 ${p.nom.replace(/[<>&"]/g, '')}</div>`,
        iconSize: [120, 30],
        iconAnchor: [60, 15],
      });
      const marker = L.marker([p.lat, p.lng], { icon });
      marker.bindPopup(
        `<b>🛵 ${p.nom.replace(/[<>&"]/g, '')}</b>${p.at ? `<br/><small>Signal : ${ilYa(p.at)}</small>` : ''}${p.detail ? `<br/>${p.detail.replace(/[<>&"]/g, '')}` : ''}`,
      );
      marker.addTo(g);
      bounds.push([p.lat, p.lng]);
    }
    if (bounds.length === 1) {
      m.setView(bounds[0], 15, { animate: true });
    } else if (bounds.length > 1) {
      m.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
    }
  }, [points]);

  return (
    <div
      ref={conteneur}
      style={{ height: hauteur }}
      className="w-full overflow-hidden rounded-2xl border border-black/10 bg-[#eef1f6]"
    />
  );
}
