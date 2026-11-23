'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from '@/app/components/Lien';
import type { BilanLivreur, ClientCRM, CommandeSuivi, LivreurGestion, ProfilUtilisateur, RestaurantGestion, StatutCommande } from '@/lib/plateforme';
import type { Config, Majoration } from '@/lib/config';
import type { Promo } from '@/lib/commission';
import ClientsPanel from './ClientsPanel';
import LivreursPanel from './LivreursPanel';
import RestaurantsPanel from './RestaurantsPanel';
import ReglagesPanel from './ReglagesPanel';
import type { PointTracking } from './CarteTracking';

const CarteTracking = dynamic(() => import('./CarteTracking'), { ssr: false });

type Stats = {
  totalCommandes: number;
  enCours: number;
  livrees: number;
  chiffreAffaires: number;
  aRecupererEquipe?: number;
  aRendreAdmin?: number;
  totalClients: number;
  clientsAvecEmail: number;
  livreursActifs: number;
  livreursDisponibles: number;
  restosCustom: number;
  restosDesactives: number;
};

type Campagne = {
  id: string;
  canal: 'email' | 'whatsapp';
  sujet: string | null;
  message: string;
  nb_destinataires: number;
  nb_envoyes: number;
  created_at: string;
};

type ReglagesApi = {
  config: Config;
  effectif: {
    service?: { ouvre: string; ferme: string };
    livraison: { base: number; parKm: number; min: number; max: number; rayonMaxKm: number; facteurRoute: number };
    fraisService: { pourcent: number; min: number; max: number } | null;
    livraisonGratuite: { min?: number } | null;
    colis: {
      actif: boolean;
      livraison: { base: number; parKm: number; min: number; max: number; rayonMaxKm: number };
      supplements: { petit: number; moyen: number; grand: number };
      urgent: number;
      nuit: { de: string; a: string; montant: number } | null;
    };
    commission: { restos?: Record<string, number> };
    promos: Promo[];
    commandeMin: number | null;
    supplement: {
      manuel?: { actif: boolean; nom: string; montant: number };
      nuit?: { actif: boolean; de: string; a: string; montant: number };
    } | null;
    annonce: string | null;
    pourboires: number[];
    majoration?: Majoration;
    logoUrl?: string | null;
  };
  pauseActive: boolean;
};

type Onglet = 'accueil' | 'commandes' | 'reglages' | 'clients' | 'livreurs' | 'restaurants';

const STATUTS: { cle: StatutCommande; label: string; cls: string }[] = [
  { cle: 'nouvelle', label: 'Reçue', cls: 'bg-blue-100 text-blue-800' },
  { cle: 'confirmee', label: 'Confirmée', cls: 'bg-indigo-100 text-indigo-800' },
  { cle: 'en_preparation', label: 'Préparation', cls: 'bg-amber-100 text-amber-800' },
  { cle: 'en_livraison', label: 'En livraison', cls: 'bg-purple-100 text-purple-800' },
  { cle: 'livree', label: 'Livrée', cls: 'bg-emerald-100 text-emerald-800' },
  { cle: 'annulee', label: 'Annulée', cls: 'bg-red-100 text-red-700' },
];

const BADGE_MAP = Object.fromEntries(STATUTS.map((s) => [s.cle, s])) as Record<StatutCommande, (typeof STATUTS)[number]>;

const fmtPrix = (n: number) => `${Number(n).toFixed(3).replace('.', ',')} DT`;
const fmtDate = (iso: string) => {
  try {
    return new Intl.DateTimeFormat('fr-FR', {
      timeZone: 'Africa/Tunis',
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
};

export default function PageAdmin() {
  const [chargement, setChargement] = useState(true);
  const [user, setUser] = useState<ProfilUtilisateur | null>(null);
  const [mode, setMode] = useState<'pc' | 'mobile'>('pc');
  const [onglet, setOnglet] = useState<Onglet>('commandes');

  // Login admin
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errLogin, setErrLogin] = useState('');
  const [envoiLogin, setEnvoiLogin] = useState(false);

  // Données
  const [stats, setStats] = useState<Stats | null>(null);
  const [commandes, setCommandes] = useState<CommandeSuivi[]>([]);
  const [clients, setClients] = useState<ClientCRM[]>([]);
  const [campagnes, setCampagnes] = useState<Campagne[]>([]);
  const [livreurs, setLivreurs] = useState<LivreurGestion[]>([]);
  const [bilanLivreurs, setBilanLivreurs] = useState<Record<string, BilanLivreur>>({});
  const [totalARecuperer, setTotalARecuperer] = useState(0);
  const [restaurants, setRestaurants] = useState<RestaurantGestion[]>([]);
  const [reglages, setReglages] = useState<ReglagesApi | null>(null);

  // Filtres commandes
  const [filtreStatut, setFiltreStatut] = useState<'en_cours' | 'toutes' | StatutCommande>('en_cours');
  const [qCmd, setQCmd] = useState('');
  const [notifierEmail, setNotifierEmail] = useState(true);
  const [majId, setMajId] = useState<string | null>(null);
  const [switchBusy, setSwitchBusy] = useState<string | null>(null);
  const [notifBanner, setNotifBanner] = useState<{ texte: string; whatsappUrl?: string } | null>(null);

  // Partage GPS temps réel du livreur / admin + suivi carte équipe
  const [gpsActif, setGpsActif] = useState(false);
  const [gpsErreur, setGpsErreur] = useState('');
  const watchIdRef = useRef<number | null>(null);
  const lastPingRef = useRef<number>(0);
  const [trackingLivreurs, setTrackingLivreurs] = useState<
    (LivreurGestion & { commandesEnCours?: { ref: string; titre: string; statut: string }[] })[]
  >([]);

  const chargerTracking = useCallback(async () => {
    const r = await fetch('/api/admin/tracking', { credentials: 'same-origin' }).catch(() => null);
    if (r && r.ok) {
      const d = await r.json();
      setTrackingLivreurs(d.livreurs ?? []);
    }
  }, []);

  useEffect(() => {
    if (!user || user.role !== 'admin' || onglet !== 'livreurs') return;
    chargerTracking();
    const id = setInterval(() => {
      if (!document.hidden) chargerTracking();
    }, 10000);
    return () => clearInterval(id);
  }, [user, onglet, chargerTracking]);

  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null && typeof navigator !== 'undefined' && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  function basculerGps() {
    setGpsErreur('');
    if (gpsActif) {
      if (watchIdRef.current !== null && navigator.geolocation) navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
      setGpsActif(false);
      return;
    }
    if (!navigator.geolocation) {
      setGpsErreur('GPS non disponible sur cet appareil.');
      return;
    }
    setGpsActif(true);
    lastPingRef.current = 0;
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const now = Date.now();
        if (now - lastPingRef.current < 8000) return;
        lastPingRef.current = now;
        fetch('/api/livreur/position', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        })
          .then(() => {
            if (user?.role === 'admin' && onglet === 'livreurs') chargerTracking();
          })
          .catch(() => {});
      },
      () => {
        setGpsErreur('Autorisez la localisation GPS dans le navigateur.');
        setGpsActif(false);
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 },
    );
  }

  async function informerResto(c: CommandeSuivi, canal: 'whatsapp' | 'email') {
    setMajId(c.id);
    setNotifBanner(null);
    try {
      const res = await fetch('/api/admin/notifier-resto', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ commande_id: c.id, canal }),
      });
      const d = await res.json().catch(() => null);
      if (!res.ok) {
        setNotifBanner({ texte: `❌ ${d?.erreur ?? 'Impossible de notifier le restaurant.'}` });
        return;
      }
      if (canal === 'whatsapp') {
        if (d.whatsappUrl) {
          window.open(d.whatsappUrl, '_blank', 'noopener,noreferrer');
          setNotifBanner({ texte: `✓ Message WhatsApp prêt pour ${c.titre} (commande N° ${c.ref})`, whatsappUrl: d.whatsappUrl });
        } else {
          if (navigator.clipboard && d.texteResto) await navigator.clipboard.writeText(d.texteResto).catch(() => {});
          setNotifBanner({ texte: `ℹ️ Aucun numéro enregistré pour ${c.titre}. Le texte de préparation a été copié dans le presse-papier !` });
        }
      } else {
        setNotifBanner({ texte: `✓ Email de préparation envoyé à ${c.titre} (statut : ${d.emailStatut ?? 'ok'}).` });
      }
      if (user) await chargerTout(user.role);
    } finally {
      setMajId(null);
    }
  }

  // Détection auto PC vs Téléphone + préférence sauvegardée
  useEffect(() => {
    try {
      const saved = localStorage.getItem('admin_mode');
      if (saved === 'pc' || saved === 'mobile') {
        setMode(saved);
        if (saved === 'mobile') setOnglet('accueil');
        return;
      }
    } catch {
      /* ignore */
    }
    const isTel = window.innerWidth < 768;
    setMode(isTel ? 'mobile' : 'pc');
    if (isTel) setOnglet('accueil');
  }, []);

  function changerMode(next: 'pc' | 'mobile') {
    setMode(next);
    try {
      localStorage.setItem('admin_mode', next);
    } catch {
      /* ignore */
    }
    if (next === 'pc' && onglet === 'accueil') setOnglet('commandes');
  }

  const chargerTout = useCallback(async (role: string) => {
    const reqs = [
      fetch('/api/admin/stats', { credentials: 'same-origin' }),
      fetch('/api/admin/commandes', { credentials: 'same-origin' }),
    ];
    if (role === 'admin') {
      reqs.push(
        fetch('/api/admin/reglages', { credentials: 'same-origin' }),
        fetch('/api/admin/clients', { credentials: 'same-origin' }),
        fetch('/api/admin/livreurs', { credentials: 'same-origin' }),
        fetch('/api/admin/restaurants', { credentials: 'same-origin' }),
      );
    }
    const res = await Promise.all(reqs);
    if (res[0]?.ok) setStats((await res[0].json()).stats ?? null);
    if (res[1]?.ok) setCommandes((await res[1].json()).commandes ?? []);
    if (res[2]?.ok) setReglages((await res[2].json()) as ReglagesApi);
    if (res[3]?.ok) {
      const d = await res[3].json();
      setClients(d.clients ?? []);
      setCampagnes(d.campagnes ?? []);
    }
    if (res[4]?.ok) {
      const dl = await res[4].json();
      setLivreurs(dl.livreurs ?? []);
      setBilanLivreurs(dl.bilan ?? {});
      setTotalARecuperer(Number(dl.totalARecuperer ?? 0));
    }
    if (res[5]?.ok) setRestaurants((await res[5].json()).restaurants ?? []);
  }, []);

  useEffect(() => {
    fetch('/api/auth/me', { credentials: 'same-origin' })
      .then((r) => (r.ok ? r.json() : { user: null }))
      .then((d) => {
        if (d?.user && (d.user.role === 'admin' || d.user.role === 'livreur')) {
          setUser(d.user);
          if (d.user.role === 'livreur') setOnglet('commandes');
          return chargerTout(d.user.role);
        }
      })
      .finally(() => setChargement(false));
  }, [chargerTout]);

  // Auto-refresh commandes toutes les 20s
  useEffect(() => {
    if (!user) return;
    const t = setInterval(() => {
      if (!document.hidden) chargerTout(user.role);
    }, 20000);
    return () => clearInterval(t);
  }, [user, chargerTout]);

  async function connexionAdmin(e: React.FormEvent) {
    e.preventDefault();
    setErrLogin('');
    setEnvoiLogin(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ email, password }),
      });
      const d = await res.json().catch(() => null);
      if (!res.ok) return setErrLogin(d?.erreur ?? `Erreur serveur (${res.status}).`);
      if (d.user?.role !== 'admin' && d.user?.role !== 'livreur') {
        return setErrLogin('Ce compte est un compte client. Connectez-vous avec un compte administrateur.');
      }
      setUser(d.user);
      if (d.user.role === 'livreur') setOnglet('commandes');
      await chargerTout(d.user.role);
    } catch {
      setErrLogin('Erreur réseau.');
    } finally {
      setEnvoiLogin(false);
    }
  }

  async function deconnexion() {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' });
    setUser(null);
    window.location.reload();
  }

  async function majCommande(
    id: string,
    patch: { statut?: StatutCommande; livreur_id?: string | null; livreur_nom?: string | null; prendre_moi_meme?: boolean },
  ) {
    setMajId(id);
    setNotifBanner(null);
    try {
      const res = await fetch('/api/admin/commandes', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ id, ...patch, notifier_client: notifierEmail }),
      });
      const d = await res.json().catch(() => null);
      if (res.ok && d?.commande) {
        const n = d.notifications ?? {};
        const infos: string[] = [];
        if (patch.prendre_moi_meme) infos.push(`Commande N° ${d.commande.ref} prise en charge par vous`);
        else if (patch.livreur_id) infos.push(`Commande N° ${d.commande.ref} affectée à ${d.commande.livreur_nom}`);
        else if (patch.statut) infos.push(`Commande N° ${d.commande.ref} mise à jour`);
        if (n.livreurEmail === 'sent') infos.push('email livreur envoyé');
        if (n.livreurPush > 0) infos.push(`push livreur (${n.livreurPush})`);
        if (n.clientEmail === 'sent') infos.push('email client envoyé');
        if (n.adminEmail === 'sent') infos.push('admin notifié');
        setNotifBanner({ texte: `✓ ${infos.join(' · ')}`, whatsappUrl: n.whatsappLivreurUrl });
      }
      if (user) await chargerTout(user.role);
    } finally {
      setMajId(null);
    }
  }

  async function sauvegarderReglages(patch: Record<string, unknown>): Promise<string | null> {
    try {
      const res = await fetch('/api/admin/reglages', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(patch),
      });
      const d = await res.json().catch(() => null);
      if (!res.ok) return d?.erreur ?? `Erreur (${res.status})`;
      setReglages(d as ReglagesApi);
      return null;
    } catch {
      return 'Erreur réseau.';
    }
  }

  async function toggleRapide(cle: string, patch: Record<string, unknown>) {
    setSwitchBusy(cle);
    await sauvegarderReglages(patch);
    setSwitchBusy(null);
  }

  const commandesFiltrees = useMemo(() => {
    const term = qCmd.trim().toLowerCase();
    return commandes.filter((c) => {
      if (filtreStatut === 'en_cours' && (c.statut === 'livree' || c.statut === 'annulee')) return false;
      if (filtreStatut !== 'en_cours' && filtreStatut !== 'toutes' && c.statut !== filtreStatut) return false;
      if (!term) return true;
      return (
        c.ref.toLowerCase().includes(term) ||
        c.titre.toLowerCase().includes(term) ||
        c.client_nom.toLowerCase().includes(term) ||
        c.client_telephone.includes(term) ||
        c.adresse.toLowerCase().includes(term)
      );
    });
  }, [commandes, filtreStatut, qCmd]);

  if (chargement) {
    return (
      <div className="mx-auto max-w-4xl py-10">
        <div className="h-48 animate-pulse rounded-3xl bg-white" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-md py-8">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="m-0 text-2xl font-extrabold">Espace Admin</h1>
          <Link href="/" className="text-sm font-bold text-primary underline">
            ← Site
          </Link>
        </div>
        <form onSubmit={connexionAdmin} className="flex flex-col gap-3 rounded-3xl bg-white p-6 shadow-sm">
          <p className="m-0 text-sm text-muted">Connectez-vous avec votre compte administrateur ou livreur pour gérer les commandes, les réglages, les clients et les restaurants.</p>
          {errLogin && <p className="m-0 rounded-xl bg-red-50 px-3.5 py-2.5 text-xs font-bold text-red-700">{errLogin}</p>}
          <label className="text-sm font-bold">
            Email admin
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@livraison.tn"
              className="mt-1 w-full rounded-xl border border-black/10 px-3.5 py-3 text-base outline-none focus:border-primary"
            />
          </label>
          <label className="text-sm font-bold">
            Mot de passe
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="mt-1 w-full rounded-xl border border-black/10 px-3.5 py-3 text-base outline-none focus:border-primary"
            />
          </label>
          <button type="submit" disabled={envoiLogin} className="mt-2 h-12 rounded-2xl bg-ink text-base font-extrabold text-white hover:opacity-90 disabled:opacity-50">
            {envoiLogin ? 'Connexion…' : 'Accéder à l’administration'}
          </button>
        </form>
      </div>
    );
  }

  const pauseActive = reglages?.pauseActive ?? false;
  const livGratActive = Boolean(reglages?.effectif.livraisonGratuite);
  const pluieActive = Boolean(reglages?.effectif.supplement?.manuel?.actif);
  const colisActif = reglages?.effectif.colis.actif ?? true;

  return (
    <div className={`mx-auto flex flex-col gap-4 py-4 ${mode === 'mobile' ? 'max-w-lg pb-24' : 'max-w-6xl'}`}>
      {/* En-tête Admin avec bascule PC Tableaux ⇄ Téléphone Simplifié */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl bg-ink p-4 text-white sm:p-5">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className={`inline-block h-2.5 w-2.5 rounded-full ${pauseActive ? 'bg-red-400' : 'bg-emerald-400'}`} />
            <p className="m-0 text-xs font-bold uppercase tracking-wider text-white/75">
              {pauseActive ? 'Site en pause' : 'Site ouvert'} · {user.role}
            </p>
          </div>
          <h1 className="m-0 truncate text-lg font-extrabold sm:text-2xl">{user.nom || 'Administration'}</h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={basculerGps}
            className={`h-9 rounded-xl px-3 text-xs font-extrabold transition ${gpsActif ? 'bg-emerald-500 text-white shadow-sm' : 'bg-white/15 text-white hover:bg-white/25'}`}
          >
            {gpsActif ? '📡 GPS actif' : '📡 Partager GPS'}
          </button>
          {/* Sélecteur de mode PC / Téléphone */}
          <div className="flex rounded-xl bg-white/10 p-1">
            <button
              type="button"
              onClick={() => changerMode('mobile')}
              className={`h-8 rounded-lg px-2.5 text-xs font-extrabold transition ${mode === 'mobile' ? 'bg-white text-ink shadow-sm' : 'text-white/80 hover:text-white'}`}
            >
              📱 Téléphone
            </button>
            <button
              type="button"
              onClick={() => changerMode('pc')}
              className={`h-8 rounded-lg px-2.5 text-xs font-extrabold transition ${mode === 'pc' ? 'bg-white text-ink shadow-sm' : 'text-white/80 hover:text-white'}`}
            >
              💻 PC Tableaux
            </button>
          </div>
          <button
            type="button"
            onClick={() => chargerTout(user.role)}
            className="h-9 rounded-xl bg-white/15 px-3 text-xs font-extrabold text-white hover:bg-white/25"
          >
            ↻
          </button>
          <button type="button" onClick={deconnexion} className="h-9 rounded-xl bg-white px-3 text-xs font-extrabold text-ink">
            Quitter
          </button>
        </div>
      </div>

      {gpsErreur && <div className="rounded-2xl bg-amber-50 px-4 py-2.5 text-xs font-bold text-amber-900">⚠️ {gpsErreur}</div>}

      {/* KPIs en mode PC */}
      {mode === 'pc' && stats && (
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-5">
          <div className="rounded-2xl bg-white p-3.5 shadow-sm">
            <p className="m-0 text-[11px] font-bold uppercase text-muted">En cours</p>
            <p className="m-0 mt-1 text-2xl font-extrabold text-primary">{stats.enCours}</p>
            <p className="m-0 text-[11px] text-muted">{stats.totalCommandes} au total</p>
          </div>
          <div className="rounded-2xl bg-white p-3.5 shadow-sm">
            <p className="m-0 text-[11px] font-bold uppercase text-muted">CA cumulé</p>
            <p className="m-0 mt-1 text-lg font-extrabold text-ink sm:text-xl">{fmtPrix(stats.chiffreAffaires)}</p>
            <p className="m-0 text-[11px] text-muted">{stats.livrees} livrées</p>
          </div>
          <div className="rounded-2xl bg-white p-3.5 shadow-sm">
            <p className="m-0 text-[11px] font-bold uppercase text-muted">Base clients</p>
            <p className="m-0 mt-1 text-2xl font-extrabold text-ink">{stats.totalClients}</p>
            <p className="m-0 text-[11px] text-muted">{stats.clientsAvecEmail} avec email</p>
          </div>
          <div className="rounded-2xl bg-white p-3.5 shadow-sm">
            <p className="m-0 text-[11px] font-bold uppercase text-muted">Livreurs</p>
            <p className="m-0 mt-1 text-2xl font-extrabold text-emerald-700">{stats.livreursDisponibles}/{stats.livreursActifs}</p>
            <p className="m-0 text-[11px] text-muted">disponibles</p>
          </div>
          <button
            type="button"
            onClick={() => user.role === 'admin' && setOnglet('livreurs')}
            className="col-span-2 rounded-2xl bg-emerald-50 p-3.5 text-left shadow-sm border border-emerald-200 sm:col-span-1"
          >
            <p className="m-0 text-[11px] font-bold uppercase text-emerald-800">À récupérer (équipe)</p>
            <p className="m-0 mt-1 text-lg font-extrabold text-emerald-700 sm:text-xl">{fmtPrix(stats.aRecupererEquipe ?? 0)}</p>
            <p className="m-0 text-[11px] text-emerald-800/80">Gérer caisse →</p>
          </button>
        </div>
      )}

      {/* Bandeau dédié sous-livreur : bilan transparent + alertes Push téléphone */}
      {user.role === 'livreur' && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-3xl border border-amber-300 bg-amber-50 p-4">
          <div>
            <p className="m-0 text-sm font-extrabold text-ink">🛵 Mes courses — {stats?.livrees ?? 0} livrée(s) · {stats?.enCours ?? 0} en cours</p>
            <p className="m-0 mt-0.5 text-xs font-bold text-emerald-800">
              Part à remettre à l’Admin : {fmtPrix(stats?.aRendreAdmin ?? 0)}
            </p>
          </div>
          <a href="/api/push" className="inline-flex h-10 items-center rounded-xl bg-amber-500 px-4 text-xs font-extrabold text-white">
            🔔 Activer mes alertes Push
          </a>
        </div>
      )}

      {/* Navigation par onglets en haut (Mode PC) */}
      {mode === 'pc' && (
        <div className="no-scrollbar flex gap-1.5 overflow-x-auto rounded-2xl bg-black/5 p-1">
          {([
            ['commandes', `📦 ${user.role === 'livreur' ? 'Mes commandes' : 'Commandes'} (${stats?.enCours ?? commandes.length})`],
            ...(user.role === 'admin'
              ? ([
                  ['livreurs', `🛵 Équipe & Gains (${livreurs.length})`],
                  ['restaurants', '🍽️ Restos & Prix'],
                  ['clients', `👥 Clients (${clients.length})`],
                  ['reglages', '⚙️ Réglages'],
                ] as const)
              : []),
          ] as const).map(([cle, label]) => (
            <button
              key={cle}
              type="button"
              onClick={() => setOnglet(cle)}
              className={`h-11 shrink-0 flex-1 whitespace-nowrap rounded-xl px-4 text-xs font-extrabold transition sm:text-sm ${
                onglet === cle ? 'bg-white text-ink shadow-sm' : 'text-muted hover:text-ink'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {/* ÉCRAN ACCUEIL SIMPLIFIÉ (Mode Téléphone, admin uniquement) */}
      {mode === 'mobile' && user.role === 'admin' && onglet === 'accueil' && (
        <div className="flex flex-col gap-3">
          {/* Alerte commandes en cours */}
          <button
            type="button"
            onClick={() => setOnglet('commandes')}
            className="flex items-center justify-between rounded-3xl border-2 border-primary bg-white px-5 py-4 text-left shadow-sm"
          >
            <span className="text-lg font-extrabold text-ink">🛵 Commandes</span>
            <span className="rounded-full bg-primary px-3.5 py-1 text-sm font-extrabold text-white">
              {stats?.enCours ?? 0} en cours
            </span>
          </button>

          {/* Grosse carte Service Ouvert / Pause avec switch direct */}
          <div className="flex items-center justify-between gap-3 rounded-3xl bg-ink p-5 text-white shadow-sm">
            <div className="min-w-0">
              <p className="m-0 flex items-center gap-2 text-lg font-extrabold">
                <span className={`h-3 w-3 rounded-full ${pauseActive ? 'bg-red-400' : 'bg-emerald-400'}`} />
                {pauseActive ? 'Site en pause' : 'Site ouvert'}
              </p>
              <p className="m-0 mt-1 text-xs text-white/75">
                {pauseActive ? 'Les clients ne peuvent pas commander.' : 'Vos clients peuvent commander maintenant.'}
              </p>
            </div>
            <button
              type="button"
              disabled={switchBusy === 'pause'}
              onClick={() => toggleRapide('pause', pauseActive ? { pause: false, retour: undefined } : { pause: true })}
              className={`relative h-10 w-16 shrink-0 rounded-full transition ${pauseActive ? 'bg-red-500' : 'bg-emerald-400'}`}
              aria-label={pauseActive ? 'Reprendre' : 'Mettre en pause'}
            >
              <span className={`absolute top-1 h-8 w-8 rounded-full bg-white shadow transition ${pauseActive ? 'left-1' : 'left-7'}`} />
            </button>
          </div>

          {/* 4 tuiles raccourcis avec switches directs */}
          <h2 className="m-0 mt-1 text-sm font-extrabold uppercase tracking-wide text-muted">Raccourcis directs</h2>
          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              disabled={switchBusy === 'livgrat'}
              onClick={() => toggleRapide('livgrat', { livraisonGratuite: livGratActive ? null : {} })}
              className={`flex flex-col items-start gap-2 rounded-3xl border p-4 text-left shadow-sm ${livGratActive ? 'border-emerald-500 bg-emerald-50' : 'border-black/5 bg-white'}`}
            >
              <span className="text-2xl">🎁</span>
              <span className="text-sm font-extrabold text-ink">Livraison gratuite</span>
              <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-extrabold ${livGratActive ? 'bg-emerald-600 text-white' : 'bg-black/10 text-muted'}`}>
                {livGratActive ? 'Activée' : 'Désactivée'}
              </span>
            </button>

            <button
              type="button"
              disabled={switchBusy === 'pluie'}
              onClick={() =>
                toggleRapide('pluie', {
                  supplement: {
                    ...(reglages?.effectif.supplement ?? {}),
                    manuel: {
                      actif: !pluieActive,
                      nom: reglages?.effectif.supplement?.manuel?.nom || 'Pluie / Rush',
                      montant: reglages?.effectif.supplement?.manuel?.montant ?? 1,
                    },
                  },
                })
              }
              className={`flex flex-col items-start gap-2 rounded-3xl border p-4 text-left shadow-sm ${pluieActive ? 'border-cyan-600 bg-cyan-50' : 'border-black/5 bg-white'}`}
            >
              <span className="text-2xl">🌧️</span>
              <span className="text-sm font-extrabold text-ink">Supplément pluie</span>
              <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-extrabold ${pluieActive ? 'bg-cyan-700 text-white' : 'bg-black/10 text-muted'}`}>
                {pluieActive ? `+${reglages?.effectif.supplement?.manuel?.montant ?? 1} DT` : 'Désactivé'}
              </span>
            </button>

            <button
              type="button"
              disabled={switchBusy === 'colis'}
              onClick={() =>
                toggleRapide('colis', {
                  colis: {
                    actif: !colisActif,
                    base: reglages?.effectif.colis.livraison.base ?? 2,
                    parKm: reglages?.effectif.colis.livraison.parKm ?? 1,
                    min: reglages?.effectif.colis.livraison.min ?? 3,
                    max: reglages?.effectif.colis.livraison.max ?? 20,
                    rayonMaxKm: reglages?.effectif.colis.livraison.rayonMaxKm ?? 10,
                    moyen: reglages?.effectif.colis.supplements.moyen ?? 1,
                    grand: reglages?.effectif.colis.supplements.grand ?? 2.5,
                    urgent: reglages?.effectif.colis.urgent ?? 0,
                  },
                })
              }
              className={`flex flex-col items-start gap-2 rounded-3xl border p-4 text-left shadow-sm ${colisActif ? 'border-purple-500 bg-purple-50' : 'border-black/5 bg-white'}`}
            >
              <span className="text-2xl">📦</span>
              <span className="text-sm font-extrabold text-ink">Service colis</span>
              <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-extrabold ${colisActif ? 'bg-purple-700 text-white' : 'bg-black/10 text-muted'}`}>
                {colisActif ? 'Actif' : 'Fermé'}
              </span>
            </button>

            <a
              href="/api/push"
              className="flex flex-col items-start gap-2 rounded-3xl border border-amber-300 bg-amber-50 p-4 text-left shadow-sm"
            >
              <span className="text-2xl">🔔</span>
              <span className="text-sm font-extrabold text-ink">Alertes téléphone</span>
              <span className="rounded-full bg-amber-500 px-2.5 py-0.5 text-[11px] font-extrabold text-white">Activer Push</span>
            </a>
          </div>

          {user.role === 'admin' && (
            <button
              type="button"
              onClick={() => setOnglet('livreurs')}
              className="flex items-center justify-between rounded-3xl border border-emerald-200 bg-emerald-50 p-4 text-left shadow-sm"
            >
              <div>
                <p className="m-0 text-sm font-extrabold text-emerald-900">💰 Équipe & Gains ({livreurs.length})</p>
                <p className="m-0 text-xs font-bold text-emerald-800">À récupérer : {fmtPrix(totalARecuperer)}</p>
              </div>
              <span className="text-xl font-bold text-emerald-700">›</span>
            </button>
          )}
        </div>
      )}

      {/* ONGLET COMMANDES */}
      {onglet === 'commandes' && (
        <div className="flex flex-col gap-4">
          {notifBanner && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-emerald-50 px-4 py-3 text-xs font-extrabold text-emerald-900">
              <span>{notifBanner.texte}</span>
              <div className="flex items-center gap-2">
                {notifBanner.whatsappUrl && (
                  <a href={notifBanner.whatsappUrl} target="_blank" rel="noreferrer" className="rounded-xl bg-[#25D366] px-3 py-1.5 text-xs font-extrabold text-white">
                    💬 Envoyer aussi au livreur sur WhatsApp
                  </a>
                )}
                <button type="button" onClick={() => setNotifBanner(null)} className="text-muted">✕</button>
              </div>
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="search"
              value={qCmd}
              onChange={(e) => setQCmd(e.target.value)}
              placeholder="Rechercher N°, client, tél, resto…"
              className="h-11 min-w-[200px] flex-1 rounded-xl border border-black/10 bg-white px-3.5 text-sm outline-none focus:border-primary"
            />
            <label className="flex h-11 items-center gap-2 rounded-xl border border-black/10 bg-white px-3 text-xs font-bold">
              <input type="checkbox" checked={notifierEmail} onChange={(e) => setNotifierEmail(e.target.checked)} className="h-4 w-4 accent-primary" />
              Email auto au client
            </label>
          </div>

          <div className="no-scrollbar flex gap-1.5 overflow-x-auto pb-1">
            {([
              ['en_cours', 'En cours'],
              ['toutes', 'Toutes'],
              ...STATUTS.map((s) => [s.cle, s.label] as const),
            ] as const).map(([cle, label]) => (
              <button
                key={cle}
                type="button"
                onClick={() => setFiltreStatut(cle)}
                className={`h-9 shrink-0 rounded-full border px-3.5 text-xs font-extrabold ${
                  filtreStatut === cle ? 'border-primary bg-primary text-white' : 'border-black/10 bg-white text-ink'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {commandesFiltrees.length === 0 ? (
            <div className="rounded-3xl bg-white p-8 text-center text-sm text-muted">Aucune commande dans ce filtre.</div>
          ) : mode === 'pc' ? (
            /* TABLEAU CLAIR MODE PC */
            <div className="overflow-x-auto rounded-3xl border border-black/5 bg-white p-4 shadow-sm">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-black/10 text-[11px] font-extrabold uppercase text-muted">
                    <th className="py-2.5 pr-3">N° / Date</th>
                    <th className="py-2.5 pr-3">Restaurant & Articles</th>
                    <th className="py-2.5 pr-3">Client & Adresse</th>
                    <th className="py-2.5 pr-3">Total</th>
                    <th className="py-2.5 pr-3">Livreur</th>
                    <th className="py-2.5 text-right">Statut & Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {commandesFiltrees.map((c) => {
                    const badge = BADGE_MAP[c.statut] ?? STATUTS[0];
                    const busy = majId === c.id;
                    return (
                      <tr key={c.id} className="border-b border-black/5 align-top hover:bg-[#f8f9fc]">
                        <td className="py-3 pr-3 whitespace-nowrap">
                          <div className="font-extrabold text-ink">N° {c.ref}</div>
                          <div className="text-[11px] text-muted">{fmtDate(c.creee)}</div>
                        </td>
                        <td className="py-3 pr-3 max-w-[260px]">
                          <div className="font-extrabold text-ink">{c.titre}</div>
                          <ul className="m-0 mt-1 list-none space-y-0.5 p-0 text-[11px] text-muted">
                            {(c.lignes ?? []).map((l, i) => (
                              <li key={i}>• {l}</li>
                            ))}
                          </ul>
                          {c.type === 'repas' && (
                            <div className="mt-2 flex flex-wrap items-center gap-1">
                              <button type="button" disabled={busy} onClick={() => informerResto(c, 'whatsapp')} className="rounded-lg bg-[#25D366]/15 px-2 py-0.5 text-[10px] font-extrabold text-[#14753d]">
                                🍽️ WA resto
                              </button>
                              <button type="button" disabled={busy} onClick={() => informerResto(c, 'email')} className="rounded-lg border border-black/10 bg-white px-2 py-0.5 text-[10px] font-bold text-ink">
                                📧 Email resto
                              </button>
                              {c.resto_telephone && (
                                <a href={`tel:${c.resto_telephone}`} className="rounded-lg border border-black/10 bg-white px-2 py-0.5 text-[10px] font-bold text-ink">
                                  📞 Resto
                                </a>
                              )}
                              {c.resto_notifie_at && (
                                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-extrabold text-emerald-800">
                                  ✅ Resto informé
                                </span>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="py-3 pr-3 max-w-[220px]">
                          <div className="font-extrabold text-ink">{c.client_nom}</div>
                          <div className="text-[11px] text-muted">+{c.client_telephone}</div>
                          <div className="text-[11px] text-muted">{c.adresse}</div>
                          {c.note && <div className="text-[11px] italic text-amber-800">📝 {c.note}</div>}
                          <div className="mt-1 flex gap-1">
                            <a href={`tel:+${c.client_telephone}`} className="rounded border border-black/10 bg-white px-2 py-0.5 text-[10px] font-bold">📞</a>
                            <a
                              href={`https://wa.me/${c.client_telephone}?text=${encodeURIComponent(`Bonjour ${c.client_nom}, concernant votre commande N° ${c.ref} (${c.titre}) : `)}`}
                              target="_blank"
                              rel="noreferrer"
                              className="rounded bg-[#25D366] px-2 py-0.5 text-[10px] font-extrabold text-white"
                            >
                              WA
                            </a>
                          </div>
                        </td>
                        <td className="py-3 pr-3 whitespace-nowrap">
                          <div className="font-extrabold text-primary">{fmtPrix(c.total)}</div>
                          {Number(c.part_admin ?? 0) > 0 && (
                            <div className={`text-[10px] font-extrabold ${c.regle_admin ? 'text-muted' : 'text-emerald-700'}`}>
                              {c.regle_admin ? '✅ Réglé' : `Ta part : +${fmtPrix(Number(c.part_admin))}`}
                            </div>
                          )}
                        </td>
                        <td className="py-3 pr-3">
                          {user.role === 'admin' ? (
                            <div className="flex flex-col gap-1.5">
                              <select
                                disabled={busy}
                                value={c.livreur_id ?? ''}
                                onChange={(e) => {
                                  const idLiv = e.target.value || null;
                                  const liv = livreurs.find((x) => x.id === idLiv);
                                  majCommande(c.id, { livreur_id: idLiv, livreur_nom: liv?.nom ?? null });
                                }}
                                className="h-8 rounded-lg border border-black/10 bg-white px-2 text-[11px] font-bold"
                              >
                                <option value="">Non assigné</option>
                                {livreurs.filter((l) => l.actif).map((l) => (
                                  <option key={l.id} value={l.id}>{l.nom}</option>
                                ))}
                              </select>
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => majCommande(c.id, { prendre_moi_meme: true })}
                                className="h-7 rounded-lg bg-primary/10 px-2 text-[10px] font-extrabold text-primary hover:bg-primary/20"
                              >
                                🙋 Prendre moi-même
                              </button>
                            </div>
                          ) : (
                            <span className="font-bold text-ink">🛵 {c.livreur_nom || 'Vous'}</span>
                          )}
                        </td>
                        <td className="py-3 text-right">
                          <div className="mb-1.5 flex justify-end">
                            <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-extrabold ${badge.cls}`}>{badge.label}</span>
                          </div>
                          <div className="flex flex-wrap justify-end gap-1">
                            {STATUTS.filter((s) => s.cle !== c.statut).map((s) => (
                              <button
                                key={s.cle}
                                type="button"
                                disabled={busy}
                                onClick={() => majCommande(c.id, { statut: s.cle })}
                                className={`rounded-lg px-2 py-1 text-[10px] font-extrabold ${
                                  s.cle === 'livree'
                                    ? 'bg-emerald-600 text-white'
                                    : s.cle === 'annulee'
                                      ? 'bg-red-50 text-red-700'
                                      : 'border border-black/10 bg-white text-ink hover:bg-black/5'
                                }`}
                              >
                                {s.label}
                              </button>
                            ))}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            /* CARTES TACTILES SIMPLIFIÉES MODE TÉLÉPHONE */
            <div className="flex flex-col gap-3">
              {commandesFiltrees.map((c) => {
                const badge = BADGE_MAP[c.statut] ?? STATUTS[0];
                const busy = majId === c.id;
                return (
                  <article key={c.id} className="rounded-3xl border border-black/5 bg-white p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-base font-extrabold text-ink">{c.titre}</span>
                          <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-extrabold ${badge.cls}`}>{badge.label}</span>
                        </div>
                        <p className="m-0 mt-0.5 text-xs text-muted">N° {c.ref} · {fmtDate(c.creee)}</p>
                      </div>
                      <p className="m-0 text-base font-extrabold text-primary">{fmtPrix(c.total)}</p>
                    </div>

                    <p className="m-0 mt-2 text-xs font-bold text-ink">👤 {c.client_nom} · 📍 {c.adresse}</p>
                    <ul className="mt-2 space-y-0.5 rounded-2xl bg-[#f6f7fb] p-3 text-xs text-ink">
                      {(c.lignes ?? []).map((l, i) => (
                        <li key={i}>• {l}</li>
                      ))}
                    </ul>

                    <div className="mt-2.5 grid grid-cols-2 gap-2">
                      <a href={`tel:+${c.client_telephone}`} className="flex h-11 items-center justify-center rounded-2xl border border-black/10 text-xs font-extrabold text-ink">
                        📞 Appeler client
                      </a>
                      <a
                        href={`https://wa.me/${c.client_telephone}?text=${encodeURIComponent(`Bonjour ${c.client_nom}, concernant votre commande N° ${c.ref} : `)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex h-11 items-center justify-center rounded-2xl bg-[#25D366] text-xs font-extrabold text-white"
                      >
                        💬 WA client
                      </a>
                    </div>

                    {c.type === 'repas' && (
                      <div className="mt-2 flex flex-wrap items-center gap-1.5 rounded-2xl bg-amber-50/70 p-2.5">
                        <span className="text-[11px] font-extrabold text-ink">🍽️ Resto :</span>
                        <button type="button" disabled={busy} onClick={() => informerResto(c, 'whatsapp')} className="h-8 rounded-xl bg-[#25D366] px-2.5 text-[11px] font-extrabold text-white">
                          💬 Informer WA
                        </button>
                        <button type="button" disabled={busy} onClick={() => informerResto(c, 'email')} className="h-8 rounded-xl border border-black/10 bg-white px-2.5 text-[11px] font-bold text-ink">
                          📧 Email
                        </button>
                        {c.resto_telephone && (
                          <a href={`tel:${c.resto_telephone}`} className="inline-flex h-8 items-center rounded-xl border border-black/10 bg-white px-2.5 text-[11px] font-bold text-ink">
                            📞 Appeler
                          </a>
                        )}
                        {c.resto_notifie_at && (
                          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-extrabold text-emerald-800">✅ Informé</span>
                        )}
                      </div>
                    )}

                    {user.role === 'admin' && (
                      <div className="mt-2.5 flex flex-wrap items-center gap-2 rounded-2xl bg-[#f6f7fb] p-2.5">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => majCommande(c.id, { prendre_moi_meme: true })}
                          className="h-9 rounded-xl bg-primary px-3 text-xs font-extrabold text-white"
                        >
                          🙋 Prendre
                        </button>
                        <select
                          disabled={busy}
                          value={c.livreur_id ?? ''}
                          onChange={(e) => {
                            const idLiv = e.target.value || null;
                            const liv = livreurs.find((x) => x.id === idLiv);
                            majCommande(c.id, { livreur_id: idLiv, livreur_nom: liv?.nom ?? null });
                          }}
                          className="h-9 min-w-[140px] flex-1 rounded-xl border border-black/10 bg-white px-2.5 text-xs font-bold"
                        >
                          <option value="">Affecter un sous-livreur…</option>
                          {livreurs.filter((l) => l.actif).map((l) => (
                            <option key={l.id} value={l.id}>🛵 {l.nom}</option>
                          ))}
                        </select>
                      </div>
                    )}

                    <div className="mt-2.5 grid grid-cols-3 gap-1.5">
                      {STATUTS.map((s) => (
                        <button
                          key={s.cle}
                          type="button"
                          disabled={busy || c.statut === s.cle}
                          onClick={() => majCommande(c.id, { statut: s.cle })}
                          className={`h-10 rounded-xl text-[11px] font-extrabold disabled:opacity-40 ${
                            c.statut === s.cle
                              ? 'bg-ink text-white'
                              : s.cle === 'livree'
                                ? 'bg-emerald-600 text-white'
                                : s.cle === 'annulee'
                                  ? 'bg-red-50 text-red-700'
                                  : 'border border-black/10 bg-white text-ink'
                          }`}
                        >
                          {s.label}
                        </button>
                      ))}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ONGLET RÉGLAGES & TARIFS (TOUTES LES 15 GESTIONS) */}
      {onglet === 'reglages' && <ReglagesPanel data={reglages} onSave={sauvegarderReglages} />}

      {/* ONGLET CLIENTS CRM */}
      {onglet === 'clients' && <ClientsPanel clients={clients} campagnes={campagnes} onReload={() => chargerTout(user.role)} mode={mode} />}

      {/* ONGLET LIVREURS & GAINS + CARTE GPS TEMPS RÉEL */}
      {onglet === 'livreurs' && (
        <div className="flex flex-col gap-4">
          <section className="rounded-3xl border border-black/5 bg-white p-4 shadow-sm sm:p-5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="m-0 text-base font-extrabold">📍 Tracking GPS temps réel de l’équipe</h2>
                <p className="m-0 text-xs text-muted">Actualisé toutes les 10s. Chaque livreur active « 📡 Partager GPS » en haut de son écran.</p>
              </div>
              <button type="button" onClick={chargerTracking} className="h-9 rounded-xl border border-black/10 px-3 text-xs font-bold">
                ↻ Actualiser carte
              </button>
            </div>
            {(() => {
              const pts: PointTracking[] = trackingLivreurs
                .filter((l) => typeof l.last_lat === 'number' && typeof l.last_lng === 'number')
                .map((l) => ({
                  id: l.id,
                  nom: l.nom,
                  lat: l.last_lat!,
                  lng: l.last_lng!,
                  at: l.last_seen_at ?? undefined,
                  detail: l.commandesEnCours?.length
                    ? `${l.commandesEnCours.length} course(s) : ${l.commandesEnCours.map((c) => `N° ${c.ref} (${c.titre})`).join(', ')}`
                    : l.disponible
                      ? 'Disponible'
                      : 'Occupé',
                }));
              return pts.length > 0 ? (
                <CarteTracking points={pts} hauteur={300} />
              ) : (
                <div className="rounded-2xl bg-[#f6f7fb] p-6 text-center text-xs font-semibold text-muted">
                  Aucun livreur ne partage encore sa position GPS. Cliquez sur <b>« 📡 Partager GPS »</b> en haut pour voir votre position apparaître en direct ici !
                </div>
              );
            })()}
          </section>

          <LivreursPanel
            livreurs={livreurs}
            bilan={bilanLivreurs}
            totalARecuperer={totalARecuperer}
            onReload={() => chargerTout(user.role)}
            mode={mode}
          />
        </div>
      )}

      {/* ONGLET RESTAURANTS */}
      {onglet === 'restaurants' && <RestaurantsPanel gestions={restaurants} onReload={() => chargerTout(user.role)} mode={mode} />}

      {/* BARRE DE NAVIGATION FIXE EN BAS (Mode Téléphone, admin) */}
      {mode === 'mobile' && user.role === 'admin' && (
        <nav
          aria-label="Navigation mobile admin"
          className="fixed inset-x-0 bottom-0 z-40 border-t border-black/10 bg-white/95 backdrop-blur pb-[env(safe-area-inset-bottom)]"
        >
          <div className="mx-auto grid max-w-lg grid-cols-5 px-1 py-1.5">
            {([
              ['accueil', '🏠', 'Accueil'],
              ['commandes', '📦', `Cmds${stats?.enCours ? ` (${stats.enCours})` : ''}`],
              ['reglages', '⚙️', 'Réglages'],
              ...(user.role === 'admin'
                ? ([
                    ['clients', '👥', 'Clients'],
                    ['restaurants', '🍽️', 'Restos'],
                  ] as const)
                : []),
            ] as const).map(([cle, icone, label]) => (
              <button
                key={cle}
                type="button"
                onClick={() => setOnglet(cle)}
                className={`flex flex-col items-center justify-center gap-0.5 rounded-xl py-1.5 text-[11px] font-extrabold ${
                  onglet === cle ? 'text-primary' : 'text-muted'
                }`}
              >
                <span className="text-lg leading-none">{icone}</span>
                <span>{label}</span>
              </button>
            ))}
          </div>
        </nav>
      )}
    </div>
  );
}
