'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import type { Circle, CircleMarker, Map as LMap } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { adresseDuPoint, rechercherAdresse, type Resultat } from '@/lib/geocodage';
import { useT } from '@/lib/i18n';
import { distanceKm, type Point } from '@/lib/livraison';
import { useRetour } from '@/lib/retour';

type Props = {
  depart: Point;
  /** Centre des recherches (ville du resto). */
  zone: Point;
  /** Bouton « Ma position » : téléphone uniquement (sur PC, la position IP est fausse). */
  gps: boolean;
  /** Ouverte sans position connue : se recentre sur le premier point GPS reçu (s'il est dans la ville). */
  centrerSurMoi?: boolean;
  /** Pas de position encore choisie : le point de départ n'est qu'un centre de carte, le client doit le déplacer (ou être sur son point GPS précis). */
  ajuster?: boolean;
  onValider: (r: { point: Point; label: string }) => void;
  onFermer: () => void;
};

/**
 * Choix de l'adresse en plein écran : le repère reste au centre, le client déplace la carte
 * (ou cherche son adresse / utilise son GPS), puis valide. Pensé d'abord pour le téléphone.
 */
export default function ChoixAdresse({ depart, zone, gps, centrerSurMoi = false, ajuster = false, onValider, onFermer }: Props) {
  const tr = useT();
  const div = useRef<HTMLDivElement>(null);
  const carte = useRef<LMap | null>(null);
  const [centre, setCentre] = useState<Point>(depart);
  const [adresse, setAdresse] = useState<string>('');
  const [q, setQ] = useState('');
  const [resultats, setResultats] = useState<Resultat[] | null>(null);
  const [recherche, setRecherche] = useState(false);
  const [msg, setMsg] = useState('');
  const [moi, setMoi] = useState<(Point & { precision: number }) | null>(null); // point bleu GPS en direct
  const calquesMoi = useRef<{ cercle: Circle; point: CircleMarker } | null>(null);
  const dejaCentre = useRef(false);
  const [bouge, setBouge] = useState(false); // le client a déplacé la carte ou choisi une adresse trouvée

  // Carte : créée une fois ; chaque fin de déplacement met à jour le centre.
  useEffect(() => {
    let annule = false;
    (async () => {
      const L = (await import('leaflet')).default;
      if (annule || !div.current) return;
      const m = L.map(div.current, { zoomControl: false }).setView([depart.lat, depart.lng], 17);
      L.control.zoom({ position: 'topright' }).addTo(m);
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap' }).addTo(m);
      m.on('dragstart', () => {
        dejaCentre.current = true;
        setBouge(true);
      }); // le client a pris la main : on ne recentre plus
      m.on('moveend', () => {
        const c = m.getCenter();
        setCentre({ lat: c.lat, lng: c.lng });
      });
      carte.current = m;
    })();
    return () => {
      annule = true;
      carte.current?.remove();
      carte.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Point bleu + cercle de précision (téléphone) : affichés dès que le GPS répond, mis à jour en direct.
  useEffect(() => {
    if (!gps || !('geolocation' in navigator)) return;
    const id = navigator.geolocation.watchPosition(
      (p) => setMoi({ lat: p.coords.latitude, lng: p.coords.longitude, precision: Math.round(p.coords.accuracy) }),
      () => {}, // refus / indisponible : la carte reste utilisable à la main
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 30000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [gps]);

  useEffect(() => {
    if (!moi || !carte.current) return;
    (async () => {
      const L = (await import('leaflet')).default;
      const m = carte.current;
      if (!m) return;
      if (!calquesMoi.current) {
        calquesMoi.current = {
          cercle: L.circle([moi.lat, moi.lng], { radius: moi.precision, color: '#1a73e8', weight: 1, fillColor: '#1a73e8', fillOpacity: 0.12, interactive: false }).addTo(m),
          point: L.circleMarker([moi.lat, moi.lng], { radius: 8, color: '#fff', weight: 3, fillColor: '#1a73e8', fillOpacity: 1, interactive: false }).addTo(m),
        };
      } else {
        calquesMoi.current.cercle.setLatLng([moi.lat, moi.lng]).setRadius(moi.precision);
        calquesMoi.current.point.setLatLng([moi.lat, moi.lng]);
      }
      // Première position utile : on centre dessus si la carte a été ouverte sans adresse connue.
      if (centrerSurMoi && !dejaCentre.current && distanceKm(moi, zone) <= 30) {
        dejaCentre.current = true;
        m.setView([moi.lat, moi.lng], moi.precision > 300 ? 16 : 18);
      }
    })();
  }, [moi, centrerSurMoi, zone]);

  // Adresse sous le repère (Nominatim : au plus ~1 requête/s, on attend l'arrêt du déplacement).
  useEffect(() => {
    setAdresse('');
    const minuteur = setTimeout(async () => {
      try {
        const r = await adresseDuPoint(centre);
        setAdresse(r ? [r.label, r.detail].filter(Boolean).join(', ') : '');
      } catch {
        /* sans adresse lisible, la position reste valable */
      }
    }, 900);
    return () => clearTimeout(minuteur);
  }, [centre]);

  // Retour du téléphone : ferme la carte et revient au formulaire.
  useRetour(true, () => {
    onFermer();
    return false;
  });

  // Plein écran : bloque le défilement de la page, Échap ferme.
  useEffect(() => {
    const avant = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const touche = (e: KeyboardEvent) => e.key === 'Escape' && onFermer();
    window.addEventListener('keydown', touche);
    return () => {
      document.body.style.overflow = avant;
      window.removeEventListener('keydown', touche);
    };
  }, [onFermer]);

  // Départ non choisi : on n'envoie jamais le centre par défaut (ni un point GPS imprécis) sans que le client l'ait vu et ajusté.
  const pret = !ajuster || bouge || (!!moi && moi.precision <= 150 && distanceKm(centre, moi) < 0.03);
  const aller = (p: Point) => carte.current?.setView([p.lat, p.lng], 18);

  async function chercher(e: FormEvent) {
    e.preventDefault();
    if (q.trim().length < 3) return;
    setRecherche(true);
    setMsg('');
    try {
      const r = await rechercherAdresse(q.trim(), zone);
      setResultats(r);
      if (!r.length) setMsg(tr('Aucune adresse trouvée. Essayez un nom de rue, de quartier ou un lieu connu.'));
    } catch {
      setMsg(tr('Recherche indisponible. Déplacez la carte jusqu’à votre adresse.'));
    } finally {
      setRecherche(false);
    }
  }

  function maPosition() {
    if (moi) {
      dejaCentre.current = true;
      setMsg(moi.precision > 150 ? tr('Position approximative (± {m} m) : ajustez la carte sur votre porte.', { m: moi.precision }) : '');
      return aller(moi);
    }
    if (!('geolocation' in navigator)) return setMsg(tr('GPS indisponible sur cet appareil.'));
    setMsg(tr('Localisation…'));
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setMsg(p.coords.accuracy > 150 ? tr('Position approximative : ajustez la carte sur votre adresse.') : '');
        aller({ lat: p.coords.latitude, lng: p.coords.longitude });
      },
      () => setMsg(tr('Localisation refusée ou indisponible : cherchez votre adresse ou déplacez la carte.')),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
    );
  }

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label={tr('Choisir l’adresse de livraison')} className="fixed inset-0 z-[1000] flex flex-col bg-white">
      <div className="flex flex-col gap-2 border-b border-black/10 p-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div className="flex items-center gap-2">
          <button type="button" onClick={onFermer} aria-label={tr('Fermer')} className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-cream text-lg">
            ✕
          </button>
          <form onSubmit={chercher} className="flex min-w-0 flex-1 items-center gap-2" role="search">
            <label className="sr-only" htmlFor="recherche-adresse">
              {tr('Rechercher une adresse')}
            </label>
            <input
              id="recherche-adresse"
              type="search"
              enterKeyHint="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={tr('Rue, quartier, lieu connu…')}
              className="h-11 min-w-0 flex-1 rounded-xl border border-black/10 bg-white px-3 text-base outline-none focus:border-primary focus:ring-2 focus:ring-primary/25"
            />
            <button type="submit" disabled={recherche} className="h-11 shrink-0 rounded-xl bg-primary px-4 text-sm font-bold text-white disabled:opacity-60">
              {recherche ? '…' : tr('Chercher')}
            </button>
          </form>
        </div>
        {msg && <p className="m-0 text-xs font-semibold text-amber-900">{msg}</p>}
        {resultats && resultats.length > 0 && (
          <ul className="max-h-60 overflow-y-auto rounded-xl border border-black/10">
            {resultats.map((r, i) => (
              <li key={i} className="border-b border-black/5 last:border-0">
                <button
                  type="button"
                  onClick={() => {
                    aller(r.point);
                    setBouge(true);
                    setResultats(null);
                  }}
                  className="flex w-full flex-col items-start px-3 py-2.5 text-start hover:bg-cream"
                >
                  <span className="text-sm font-bold">{r.label}</span>
                  {r.detail && <span className="text-xs text-muted">{r.detail}</span>}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="relative isolate min-h-0 flex-1">
        <div ref={div} dir="ltr" className="absolute inset-0" />
        <div className="pointer-events-none absolute inset-x-0 top-3 z-[500] flex justify-center px-14">
          <p className="m-0 rounded-full bg-ink/85 px-4 py-2 text-center text-xs font-semibold text-white shadow-lg">
            {tr('Déplacez la carte : la pointe du repère = votre porte')}
          </p>
        </div>
        {/* Repère fixe au centre : c'est la carte qui bouge dessous. */}
        <span aria-hidden className="pointer-events-none absolute left-1/2 top-1/2 z-[499] h-3 w-6 -translate-x-1/2 -translate-y-1/2 rounded-[50%] bg-black/25 blur-[2px]" />
        <svg width="44" height="58" viewBox="0 0 34 44" aria-hidden="true" className="pointer-events-none absolute left-1/2 top-1/2 z-[500] -translate-x-1/2 -translate-y-full drop-shadow-lg">
          <path d="M17 0C7.6 0 0 7.6 0 17c0 12.7 17 27 17 27s17-14.3 17-27C34 7.6 26.4 0 17 0z" fill="var(--couleur)" stroke="#fff" strokeWidth="2" />
          <circle cx="17" cy="17" r="6.5" fill="#fff" />
        </svg>
        {gps && (
          <button
            type="button"
            onClick={maPosition}
            className="absolute bottom-4 end-4 z-[500] flex h-12 items-center gap-2 rounded-full bg-white px-4 text-sm font-bold shadow-lg"
          >
            📍 {tr('Ma position')}
          </button>
        )}
      </div>

      <div className="flex flex-col gap-3 border-t border-black/10 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className="flex items-start gap-3">
          <span aria-hidden className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-cream text-lg">📍</span>
          <div className="min-w-0">
            <p className="m-0 text-xs font-bold uppercase tracking-wide text-muted">{tr('Livrer ici')}</p>
            <p className="m-0 text-sm font-semibold">{adresse || tr('Recherche de l’adresse…')}</p>
            {moi && <p className="m-0 mt-0.5 text-xs text-muted">{tr('Point bleu = votre position GPS (± {m} m)', { m: moi.precision })}</p>}
          </div>
        </div>
        {!pret && <p className="m-0 text-center text-xs font-semibold text-amber-900">{tr('Déplacez la carte pour mettre le repère sur votre porte.')}</p>}
        <button
          type="button"
          disabled={!pret}
          onClick={() => onValider({ point: centre, label: adresse })}
          className="h-12 w-full rounded-full bg-primary font-bold text-white disabled:opacity-40"
        >
          {tr('Valider cette adresse')}
        </button>
      </div>
    </div>,
    document.body,
  );
}
