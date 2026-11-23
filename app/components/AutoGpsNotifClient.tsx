'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

/**
 * Active automatiquement le partage GPS client (mémorisé en session pour pré-remplir la livraison)
 * et demande l'autorisation de notifications navigateur dès la première interaction.
 */
export default function AutoGpsNotifClient() {
  const pathname = usePathname() ?? '/';

  useEffect(() => {
    // Enregistre le Service Worker de mise en cache rapide des images, menus et assets statiques
    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw-app.js').catch(() => {});
    }
    if (pathname.startsWith('/admin')) return;

    // 1. GPS client activé par défaut dès l'ouverture (si pas déjà capturé dans cette session)
    try {
      const deja = sessionStorage.getItem('app_gps_client');
      if (!deja && typeof navigator !== 'undefined' && navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            try {
              sessionStorage.setItem(
                'app_gps_client',
                JSON.stringify({
                  lat: pos.coords.latitude,
                  lng: pos.coords.longitude,
                  accuracy: pos.coords.accuracy,
                  at: Date.now(),
                }),
              );
            } catch {
              /* ignore */
            }
          },
          () => {
            /* refus ou indispo : la carte manuelle reste disponible au panier */
          },
          { enableHighAccuracy: true, maximumAge: 60_000, timeout: 10_000 },
        );
      }
    } catch {
      /* ignore */
    }

    // 2. Notifications navigateur activées par défaut dès le premier geste utilisateur
    const activerNotif = () => {
      try {
        if (
          typeof Notification !== 'undefined' &&
          Notification.permission === 'default' &&
          !sessionStorage.getItem('app_notif_demande')
        ) {
          sessionStorage.setItem('app_notif_demande', '1');
          Notification.requestPermission().catch(() => {});
        }
      } catch {
        /* ignore */
      }
    };
    window.addEventListener('pointerdown', activerNotif, { once: true, passive: true });
    return () => window.removeEventListener('pointerdown', activerNotif);
  }, [pathname]);

  return null;
}
