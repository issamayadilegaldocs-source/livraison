import type { MetadataRoute } from 'next';
import { getLivreur } from '@/lib/livreur';

export const dynamic = 'force-static'; // construit au build avec le livreur du client (CLIENT)

export default function manifest(): MetadataRoute.Manifest {
  const l = getLivreur();
  return {
    name: `${l.nom} — livraison à ${l.ville}`,
    short_name: l.nom,
    description: l.slogan,
    start_url: '/',
    display: 'standalone',
    background_color: '#f4f8ff',
    theme_color: l.couleur,
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon', sizes: '512x512', type: 'image/png', purpose: 'any' },
    ],
  };
}
