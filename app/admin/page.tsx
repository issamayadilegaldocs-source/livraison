'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from '@/app/components/Lien';
import type { ClientCRM, CommandeSuivi, LivreurGestion, ProfilUtilisateur, RestaurantGestion, StatutCommande } from '@/lib/plateforme';
import ClientsPanel from './ClientsPanel';
import LivreursPanel from './LivreursPanel';
import RestaurantsPanel from './RestaurantsPanel';

type Stats = {
  totalCommandes: number;
  enCours: number;
  livrees: number;
  chiffreAffaires: number;
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
  const [onglet, setOnglet] = useState<'commandes' | 'clients' | 'livreurs' | 'restaurants'>('commandes');

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
  const [restaurants, setRestaurants] = useState<RestaurantGestion[]>([]);

  // Filtres commandes
  const [filtreStatut, setFiltreStatut] = useState<'en_cours' | 'toutes' | StatutCommande>('en_cours');
  const [qCmd, setQCmd] = useState('');
  const [notifierEmail, setNotifierEmail] = useState(true);
  const [majId, setMajId] = useState<string | null>(null);

  const chargerTout = useCallback(async (role: string) => {
    const reqs = [
      fetch('/api/admin/stats', { credentials: 'same-origin' }),
      fetch('/api/admin/commandes', { credentials: 'same-origin' }),
    ];
    if (role === 'admin') {
      reqs.push(
        fetch('/api/admin/clients', { credentials: 'same-origin' }),
        fetch('/api/admin/livreurs', { credentials: 'same-origin' }),
        fetch('/api/admin/restaurants', { credentials: 'same-origin' }),
      );
    }
    const res = await Promise.all(reqs);
    if (res[0]?.ok) setStats((await res[0].json()).stats ?? null);
    if (res[1]?.ok) setCommandes((await res[1].json()).commandes ?? []);
    if (res[2]?.ok) {
      const d = await res[2].json();
      setClients(d.clients ?? []);
      setCampagnes(d.campagnes ?? []);
    }
    if (res[3]?.ok) setLivreurs((await res[3].json()).livreurs ?? []);
    if (res[4]?.ok) setRestaurants((await res[4].json()).restaurants ?? []);
  }, []);

  useEffect(() => {
    fetch('/api/auth/me', { credentials: 'same-origin' })
      .then((r) => (r.ok ? r.json() : { user: null }))
      .then((d) => {
        if (d?.user && (d.user.role === 'admin' || d.user.role === 'livreur')) {
          setUser(d.user);
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
      const d = await res.json();
      if (!res.ok) return setErrLogin(d.erreur ?? 'Identifiants invalides.');
      if (d.user?.role !== 'admin' && d.user?.role !== 'livreur') {
        return setErrLogin('Ce compte est un compte client. Connectez-vous avec un compte administrateur.');
      }
      setUser(d.user);
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

  async function majCommande(id: string, patch: { statut?: StatutCommande; livreur_id?: string | null; livreur_nom?: string | null }) {
    setMajId(id);
    try {
      await fetch('/api/admin/commandes', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ id, ...patch, notifier_client: Boolean(patch.statut && notifierEmail) }),
      });
      if (user) await chargerTout(user.role);
    } finally {
      setMajId(null);
    }
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
          <p className="m-0 text-sm text-muted">Connectez-vous avec votre compte administrateur pour gérer les commandes, les clients, les livreurs et les restaurants.</p>
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

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-5 py-5">
      {/* En-tête Admin */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl bg-ink p-5 text-white">
        <div>
          <p className="m-0 text-xs font-bold uppercase tracking-wider text-white/70">Administration · {user.role}</p>
          <h1 className="m-0 text-xl font-extrabold sm:text-2xl">Tableau de bord {user.nom || 'Admin'}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => chargerTout(user.role)}
            className="h-10 rounded-xl bg-white/15 px-3.5 text-xs font-extrabold text-white hover:bg-white/25"
          >
            ↻ Actualiser
          </button>
          <Link href="/" className="flex h-10 items-center rounded-xl bg-white/15 px-3.5 text-xs font-extrabold text-white hover:bg-white/25">
            Voir le site
          </Link>
          <button type="button" onClick={deconnexion} className="h-10 rounded-xl bg-white px-3.5 text-xs font-extrabold text-ink">
            Déconnexion
          </button>
        </div>
      </div>

      {/* KPIs */}
      {stats && (
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
          <div className="col-span-2 rounded-2xl bg-white p-3.5 shadow-sm sm:col-span-1">
            <p className="m-0 text-[11px] font-bold uppercase text-muted">Restos gérés</p>
            <p className="m-0 mt-1 text-2xl font-extrabold text-ink">+{stats.restosCustom}</p>
            <p className="m-0 text-[11px] text-muted">{stats.restosDesactives} désactivé(s)</p>
          </div>
        </div>
      )}

      {/* Navigation par onglets */}
      <div className="no-scrollbar flex gap-1.5 overflow-x-auto rounded-2xl bg-black/5 p-1">
        {([
          ['commandes', `📦 Commandes (${stats?.enCours ?? commandes.length})`],
          ...(user.role === 'admin'
            ? ([
                ['clients', `👥 Clients CRM (${clients.length})`],
                ['livreurs', `🛵 Livreurs (${livreurs.length})`],
                ['restaurants', '🍽️ Restaurants'],
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

      {/* ONGLET COMMANDES */}
      {onglet === 'commandes' && (
        <div className="flex flex-col gap-4">
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
          ) : (
            <div className="flex flex-col gap-3">
              {commandesFiltrees.map((c) => {
                const badge = BADGE_MAP[c.statut] ?? STATUTS[0];
                const busy = majId === c.id;
                return (
                  <article key={c.id} className="rounded-3xl border border-black/5 bg-white p-4 shadow-sm sm:p-5">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-base font-extrabold text-ink">{c.titre}</span>
                          <span className={`rounded-full px-2.5 py-0.5 text-xs font-extrabold ${badge.cls}`}>{badge.label}</span>
                          <span className="rounded-full bg-black/5 px-2 py-0.5 text-[11px] font-bold text-ink">N° {c.ref}</span>
                        </div>
                        <p className="m-0 mt-1 text-xs text-muted">
                          📅 {fmtDate(c.creee)} · 👤 <b>{c.client_nom}</b> · 📞 +{c.client_telephone}
                          {c.client_email ? ` · ✉️ ${c.client_email}` : ''}
                        </p>
                        <p className="m-0 text-xs text-muted">
                          📍 {c.adresse}
                          {c.note ? ` · 📝 ${c.note}` : ''}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="m-0 text-lg font-extrabold text-ink">{fmtPrix(c.total)}</p>
                        <div className="mt-1 flex justify-end gap-1.5">
                          <a href={`tel:+${c.client_telephone}`} className="rounded-lg border border-black/10 px-2.5 py-1 text-xs font-bold text-ink">
                            📞
                          </a>
                          <a
                            href={`https://wa.me/${c.client_telephone}?text=${encodeURIComponent(`Bonjour ${c.client_nom}, concernant votre commande N° ${c.ref} (${c.titre}) : `)}`}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-lg bg-[#25D366] px-2.5 py-1 text-xs font-extrabold text-white"
                          >
                            WhatsApp
                          </a>
                        </div>
                      </div>
                    </div>

                    <ul className="mt-3 space-y-0.5 rounded-2xl bg-[#f6f7fb] p-3 text-xs text-ink">
                      {(c.lignes ?? []).map((l, i) => (
                        <li key={i}>• {l}</li>
                      ))}
                    </ul>

                    {/* Assignation livreur + changement statut */}
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-black/5 pt-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-muted">🛵 Livreur :</span>
                        <select
                          disabled={busy}
                          value={c.livreur_id ?? ''}
                          onChange={(e) => {
                            const idLiv = e.target.value || null;
                            const liv = livreurs.find((x) => x.id === idLiv);
                            majCommande(c.id, { livreur_id: idLiv, livreur_nom: liv?.nom ?? null });
                          }}
                          className="h-9 rounded-xl border border-black/10 bg-white px-2.5 text-xs font-bold"
                        >
                          <option value="">Non assigné</option>
                          {livreurs.filter((l) => l.actif).map((l) => (
                            <option key={l.id} value={l.id}>
                              {l.nom} ({l.disponible ? 'Dispo' : 'Occupé'})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="flex flex-wrap gap-1.5">
                        {STATUTS.map((s) => (
                          <button
                            key={s.cle}
                            type="button"
                            disabled={busy || c.statut === s.cle}
                            onClick={() => majCommande(c.id, { statut: s.cle })}
                            className={`h-9 rounded-xl px-3 text-xs font-extrabold transition disabled:opacity-40 ${
                              c.statut === s.cle
                                ? 'bg-ink text-white'
                                : s.cle === 'livree'
                                  ? 'bg-emerald-600 text-white hover:opacity-90'
                                  : s.cle === 'annulee'
                                    ? 'bg-red-50 text-red-700 hover:bg-red-100'
                                    : 'border border-black/10 bg-white text-ink hover:bg-black/5'
                            }`}
                          >
                            {s.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ONGLET CLIENTS CRM */}
      {onglet === 'clients' && <ClientsPanel clients={clients} campagnes={campagnes} onReload={() => chargerTout(user.role)} />}

      {/* ONGLET LIVREURS */}
      {onglet === 'livreurs' && <LivreursPanel livreurs={livreurs} onReload={() => chargerTout(user.role)} />}

      {/* ONGLET RESTAURANTS */}
      {onglet === 'restaurants' && <RestaurantsPanel gestions={restaurants} onReload={() => chargerTout(user.role)} />}
    </div>
  );
}
