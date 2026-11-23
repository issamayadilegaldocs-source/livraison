import type { StatutCommande } from '@/lib/plateforme';

export type RestoInfoIndex = {
  slug: string;
  nom: string;
  telephone?: string;
  adresse?: string;
  position?: { lat: number; lng: number } | null;
};

/** Distance à vol d'oiseau en kilomètres (Haversine). */
export function distanceEnKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

export function formaterDistance(km: number | null): string {
  if (km === null || !Number.isFinite(km)) return 'GPS off';
  if (km < 1) return `à ${Math.max(50, Math.round((km * 1000) / 50) * 50)} m`;
  if (km < 100) return `à ${km.toFixed(1).replace('.', ',')} km`;
  return `à ${Math.round(km)} km`;
}

export function lienGoogleMaps(adresse?: string | null, pos?: { lat: number; lng: number } | null): string {
  if (pos && Number.isFinite(pos.lat) && Number.isFinite(pos.lng)) {
    return `https://www.google.com/maps/dir/?api=1&destination=${pos.lat},${pos.lng}`;
  }
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(adresse || 'Sfax')}`;
}

export function prochaineEtape(statut: StatutCommande): { cle: StatutCommande; label: string; cls: string } | null {
  switch (statut) {
    case 'nouvelle':
      return { cle: 'confirmee', label: '✓ Confirmer la commande', cls: 'bg-indigo-600 text-white' };
    case 'confirmee':
      return { cle: 'en_preparation', label: '🍳 Marquer en préparation', cls: 'bg-amber-500 text-white' };
    case 'en_preparation':
      return { cle: 'en_livraison', label: '🛵 Partir en livraison', cls: 'bg-purple-600 text-white' };
    case 'en_livraison':
      return { cle: 'livree', label: '✅ Marquer comme livrée', cls: 'bg-emerald-600 text-white' };
    default:
      return null;
  }
}

let audioCtx: AudioContext | null = null;

/** Prépare le contexte audio (à appeler dans un clic utilisateur sur mobile) et demande la permission Notification. */
export async function activerAlertesNavigateur(): Promise<boolean> {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (Ctx) {
      audioCtx ??= new Ctx();
      if (audioCtx.state === 'suspended') await audioCtx.resume();
    }
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      await Notification.requestPermission().catch(() => {});
    }
    return true;
  } catch {
    return false;
  }
}

/** Joue une sonnerie courte (triple bip clair) + vibration mobile + notification navigateur. */
export function declencherAlerte(titre: string, corps: string) {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (Ctx) {
      audioCtx ??= new Ctx();
      if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
      const now = audioCtx.currentTime;
      const notes = [880, 1175, 1397];
      notes.forEach((freq, i) => {
        if (!audioCtx) return;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + i * 0.16);
        gain.gain.setValueAtTime(0.001, now + i * 0.16);
        gain.gain.exponentialRampToValueAtTime(0.28, now + i * 0.16 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.16 + 0.14);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(now + i * 0.16);
        osc.stop(now + i * 0.16 + 0.15);
      });
    }
  } catch {
    /* audio bloqué avant interaction utilisateur */
  }
  try {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate([250, 100, 250, 100, 350]);
    }
  } catch {
    /* ignore */
  }
  try {
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      new Notification(titre, { body: corps, icon: '/icon-192.png' });
    }
  } catch {
    /* ignore */
  }
}
