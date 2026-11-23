'use client';

import { useCallback, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from '@/app/components/Lien';
import ChatCommandeBox from '@/app/components/ChatCommandeBox';
import ReseauxSociaux from '@/app/components/ReseauxSociaux';
import ParrainagePanel from './ParrainagePanel';
import SupportPanel from './SupportPanel';
import {
  ajouterAdresse,
  definirAdresseDefaut,
  lireAdresses,
  supprimerAdresse,
  type AdresseClient,
} from '@/lib/app-client';
import { CLE_CLIENT } from '@/lib/client';

const CarteTracking = dynamic(() => import('@/app/admin/CarteTracking'), { ssr: false });

type Statut = 'nouvelle' | 'confirmee' | 'en_preparation' | 'en_livraison' | 'livree' | 'annulee';

type Profil = {
  id: string;
  email: string;
  role: 'client' | 'livreur' | 'admin';
  nom: string;
  telephone: string | null;
  adresse: string | null;
  marketing_opt_in: boolean;
};

type Commande = {
  id: string;
  ref: string;
  type: 'repas' | 'colis';
  statut: Statut;
  creee: string;
  fin: string | null;
  statut_updated_at: string | null;
  historique_statuts: { statut: Statut; at: string }[];
  titre: string;
  lignes: string[];
  client_nom: string;
  adresse: string;
  note: string | null;
  resto_slug?: string | null;
  total: number;
  livreur_nom: string | null;
  livreur_position?: { lat: number; lng: number; at: string } | null;
};

const ETAPES: { cle: Statut; label: string }[] = [
  { cle: 'nouvelle', label: 'Reçue' },
  { cle: 'confirmee', label: 'Confirmée' },
  { cle: 'en_preparation', label: 'Préparation' },
  { cle: 'en_livraison', label: 'En route' },
  { cle: 'livree', label: 'Livrée' },
];

const BADGE: Record<Statut, { texte: string; cls: string }> = {
  nouvelle: { texte: 'Reçue', cls: 'bg-blue-100 text-blue-800' },
  confirmee: { texte: 'Confirmée', cls: 'bg-indigo-100 text-indigo-800' },
  en_preparation: { texte: 'En préparation', cls: 'bg-amber-100 text-amber-800' },
  en_livraison: { texte: 'En livraison', cls: 'bg-purple-100 text-purple-800' },
  livree: { texte: 'Livrée', cls: 'bg-emerald-100 text-emerald-800' },
  annulee: { texte: 'Annulée', cls: 'bg-red-100 text-red-700' },
};

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

function CarteCommande({
  c,
  guestRef,
  guestTel,
}: {
  c: Commande;
  guestRef?: string;
  guestTel?: string;
}) {
  const b = BADGE[c.statut] ?? BADGE.nouvelle;
  const idxActuel = ETAPES.findIndex((e) => e.cle === c.statut);
  const [chatOuvert, setChatOuvert] = useState(false);
  const [avisOuvert, setAvisOuvert] = useState(false);
  const [noteAvis, setNoteAvis] = useState(5);
  const [commAvis, setCommAvis] = useState('');
  const [avisEnvoye, setAvisEnvoye] = useState(false);
  const [avisErr, setAvisErr] = useState('');
  const [envoiAvis, setEnvoiAvis] = useState(false);

  async function envoyerAvis(e: React.FormEvent) {
    e.preventDefault();
    if (!c.resto_slug) return;
    setEnvoiAvis(true);
    setAvisErr('');
    try {
      const r = await fetch('/api/avis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          resto_slug: c.resto_slug,
          resto_nom: c.titre,
          commande_id: c.id,
          note: noteAvis,
          commentaire: commAvis.trim() || undefined,
          ...(guestRef ? { ref: guestRef } : {}),
          ...(guestTel ? { tel: guestTel } : {}),
        }),
      });
      const d = await r.json().catch(() => null);
      if (!r.ok) {
        setAvisErr(d?.erreur ?? 'Impossible d’enregistrer votre avis.');
        return;
      }
      setAvisEnvoye(true);
      setAvisOuvert(false);
    } catch {
      setAvisErr('Erreur réseau.');
    } finally {
      setEnvoiAvis(false);
    }
  }

  return (
    <article className="rounded-3xl border border-black/5 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-base font-extrabold text-ink">{c.titre}</span>
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-extrabold ${b.cls}`}>{b.texte}</span>
          </div>
          <p className="mt-0.5 text-xs font-semibold text-muted">
            N° {c.ref} · {fmtDate(c.creee)}
          </p>
        </div>
        <div className="shrink-0 text-right text-base font-extrabold text-ink">{fmtPrix(c.total)}</div>
      </div>

      {c.statut !== 'annulee' ? (
        <div className="mt-4">
          <div className="grid grid-cols-5 gap-1">
            {ETAPES.map((e, i) => {
              const atteint = idxActuel >= i;
              return (
                <div key={e.cle} className="flex flex-col items-center gap-1">
                  <div className={`h-2 w-full rounded-full ${atteint ? 'bg-primary' : 'bg-black/10'}`} />
                  <span className={`text-center text-[10px] font-bold leading-tight sm:text-xs ${atteint ? 'text-ink' : 'text-muted'}`}>
                    {e.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-xs font-bold text-red-700">
          Cette commande a été annulée{c.fin ? ` le ${fmtDate(c.fin)}` : ''}.
        </p>
      )}

      {c.livreur_nom && (
        <p className="mt-3 text-xs font-bold text-ink">🛵 Livreur assigné : {c.livreur_nom}</p>
      )}

      {c.livreur_position && c.statut !== 'livree' && c.statut !== 'annulee' && (
        <div className="mt-3">
          <p className="m-0 mb-1.5 flex items-center gap-1.5 text-xs font-extrabold text-emerald-700">
            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
            Position du livreur en direct
          </p>
          <CarteTracking
            hauteur={200}
            points={[
              {
                id: c.id,
                nom: c.livreur_nom || 'Livreur',
                lat: c.livreur_position.lat,
                lng: c.livreur_position.lng,
                at: c.livreur_position.at,
                detail: `Commande N° ${c.ref}`,
              },
            ]}
          />
        </div>
      )}

      <ul className="mt-3 space-y-1 border-t border-black/5 pt-3 text-xs text-ink/80 sm:text-sm">
        {(c.lignes ?? []).map((l, i) => (
          <li key={i}>• {l}</li>
        ))}
      </ul>

      <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
        <p className="m-0 text-xs text-muted">
          📍 {c.adresse}
          {c.note ? ` · 📝 ${c.note}` : ''}
        </p>
        <div className="flex flex-wrap items-center gap-1.5">
          {c.statut !== 'annulee' && (
            <button
              type="button"
              onClick={() => setChatOuvert((v) => !v)}
              className={`h-8 rounded-xl px-3 text-xs font-extrabold ${
                chatOuvert ? 'bg-ink text-white' : 'border border-black/10 bg-[#f6f7fb] text-ink'
              }`}
            >
              💬 {chatOuvert ? 'Fermer chat' : 'Chat livreur'}
            </button>
          )}
          {c.type === 'repas' && c.resto_slug && !avisEnvoye && (
            <button
              type="button"
              onClick={() => setAvisOuvert((v) => !v)}
              className="h-8 rounded-xl bg-amber-100 px-3 text-xs font-extrabold text-amber-900"
            >
              ⭐ Noter
            </button>
          )}
          {avisEnvoye && (
            <span className="rounded-xl bg-emerald-100 px-2.5 py-1 text-[11px] font-extrabold text-emerald-800">
              ✓ Avis envoyé
            </span>
          )}
          {c.type === 'repas' && (
            <Link
              href={c.resto_slug ? `/resto/${c.resto_slug}` : `/c/tout?q=${encodeURIComponent(c.titre)}`}
              className="inline-flex h-8 items-center rounded-xl bg-primary/10 px-3 text-xs font-extrabold text-primary hover:bg-primary/20"
            >
              🔄 Recommander
            </Link>
          )}
        </div>
      </div>

      {avisOuvert && c.resto_slug && (
        <form onSubmit={envoyerAvis} className="mt-3 flex flex-col gap-2 rounded-2xl bg-amber-50/70 p-3">
          <div className="flex items-center gap-1">
            <span className="text-xs font-extrabold text-ink">Note pour {c.titre} :</span>
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setNoteAvis(n)}
                className={`text-xl ${n <= noteAvis ? 'text-saffron' : 'text-black/20'}`}
              >
                ★
              </button>
            ))}
          </div>
          <input
            value={commAvis}
            onChange={(e) => setCommAvis(e.target.value)}
            maxLength={500}
            placeholder="Votre commentaire (optionnel)…"
            className="h-9 rounded-xl border border-black/10 bg-white px-3 text-xs"
          />
          {avisErr && <p className="m-0 text-xs font-bold text-red-700">{avisErr}</p>}
          <button
            type="submit"
            disabled={envoiAvis}
            className="h-9 self-start rounded-xl bg-ink px-4 text-xs font-extrabold text-white disabled:opacity-50"
          >
            {envoiAvis ? 'Envoi…' : 'Publier mon avis'}
          </button>
        </form>
      )}

      {chatOuvert && (
        <ChatCommandeBox
          commandeId={c.id}
          titre={`Chat commande N° ${c.ref}${c.livreur_nom ? ` · ${c.livreur_nom}` : ''}`}
          monRole="client"
          guestRef={guestRef}
          guestTel={guestTel}
          onClose={() => setChatOuvert(false)}
        />
      )}
    </article>
  );
}

const champ =
  'mt-1 w-full rounded-xl border border-black/10 bg-white px-3.5 py-3 text-base outline-none focus:border-primary focus:ring-2 focus:ring-primary/20';

export default function PageCompte() {
  const [chargement, setChargement] = useState(true);
  const [user, setUser] = useState<Profil | null>(null);
  const [ongletAuth, setOngletAuth] = useState<'login' | 'register' | 'suivi'>('login');
  const [ongletCompte, setOngletCompte] = useState<'commandes' | 'parrainage' | 'adresses' | 'support' | 'profil'>('commandes');
  const [commandes, setCommandes] = useState<Commande[]>([]);
  const [adresses, setAdresses] = useState<AdresseClient[]>([]);
  const [adrLabel, setAdrLabel] = useState<AdresseClient['label']>('Maison');
  const [adrTexte, setAdrTexte] = useState('');
  const [adrDetail, setAdrDetail] = useState('');
  const [msg, setMsg] = useState('');

  useEffect(() => {
    setAdresses(lireAdresses());
  }, []);

  function synchroniserAdresseActive(txt: string) {
    setAdresse(txt);
    try {
      const prev = JSON.parse(localStorage.getItem(CLE_CLIENT) ?? '{}');
      localStorage.setItem(CLE_CLIENT, JSON.stringify({ ...prev, adresse: txt }));
    } catch {
      /* ignore */
    }
  }
  const [erreur, setErreur] = useState('');
  const [envoi, setEnvoi] = useState(false);

  // Formulaires auth
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nom, setNom] = useState('');
  const [tel, setTel] = useState('');
  const [adresse, setAdresse] = useState('');
  const [optIn, setOptIn] = useState(true);

  // Suivi invité & OAuth rapide
  const [suiviRef, setSuiviRef] = useState('');
  const [suiviTel, setSuiviTel] = useState('');
  const [cmdSuivi, setCmdSuivi] = useState<Commande | null>(null);
  const [googleActif, setGoogleActif] = useState(false);
  const [magicEmail, setMagicEmail] = useState('');

  const chargerCommandes = useCallback(async () => {
    const res = await fetch('/api/compte/commandes', { credentials: 'same-origin' });
    if (res.ok) {
      const d = await res.json();
      setCommandes(d.commandes ?? []);
    }
  }, []);

  useEffect(() => {
    // Pré-remplir onglet suivi si ?ref= dans l'URL
    const p = new URLSearchParams(window.location.search);
    const refUrl = p.get('ref');
    if (refUrl) {
      setSuiviRef(refUrl);
      setOngletAuth('suivi');
    }

    // Détecter si Google OAuth est activé côté Supabase
    fetch('/api/auth/providers')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d) setGoogleActif(Boolean(d.google));
      })
      .catch(() => {});

    // Finaliser un retour OAuth Google ou Lien Magique (#access_token=...)
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const accessToken = hashParams.get('access_token');
    const init = accessToken
      ? fetch('/api/auth/oauth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({ access_token: accessToken }),
        })
          .then((r) => (r.ok ? r.json() : { user: null }))
          .finally(() => {
            window.history.replaceState(null, '', window.location.pathname + window.location.search);
          })
      : fetch('/api/auth/me', { credentials: 'same-origin' }).then((r) => (r.ok ? r.json() : { user: null }));

    init
      .then((d) => {
        if (d?.user) {
          if (accessToken && (d.user.role === 'admin' || d.user.role === 'livreur')) {
            window.location.href = '/admin';
            return;
          }
          setUser(d.user);
          setNom(d.user.nom ?? '');
          setTel(d.user.telephone ? d.user.telephone.replace(/^216/, '') : '');
          setAdresse(d.user.adresse ?? '');
          setOptIn(d.user.marketing_opt_in ?? true);
          chargerCommandes();
        }
      })
      .finally(() => setChargement(false));
  }, [chargerCommandes]);

  // Rafraîchissement automatique des commandes toutes les 20s quand connecté
  useEffect(() => {
    if (!user) return;
    const t = setInterval(() => {
      if (!document.hidden) chargerCommandes();
    }, 8000);
    return () => clearInterval(t);
  }, [user, chargerCommandes]);

  // Auto-rafraîchissement toutes les 8s pour le suivi invité tant que la commande est active
  useEffect(() => {
    if (!cmdSuivi || cmdSuivi.statut === 'livree' || cmdSuivi.statut === 'annulee') return;
    if (!suiviRef.trim() || !suiviTel.trim()) return;
    const t = setInterval(() => {
      if (document.hidden) return;
      fetch(`/api/suivi?ref=${encodeURIComponent(suiviRef.trim())}&tel=${encodeURIComponent(suiviTel.trim())}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (d?.commande) setCmdSuivi(d.commande);
        })
        .catch(() => {});
    }, 8000);
    return () => clearInterval(t);
  }, [cmdSuivi, suiviRef, suiviTel]);

  async function connexion(e: React.FormEvent) {
    e.preventDefault();
    setErreur('');
    setMsg('');
    setEnvoi(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ email, password }),
      });
      const d = await res.json();
      if (!res.ok) return setErreur(d.erreur ?? 'Connexion échouée.');
      if (d.user?.role === 'admin' || d.user?.role === 'livreur') {
        window.location.href = '/admin';
        return;
      }
      setUser(d.user);
      setNom(d.user.nom ?? '');
      setTel(d.user.telephone ? d.user.telephone.replace(/^216/, '') : '');
      setAdresse(d.user.adresse ?? '');
      setOptIn(d.user.marketing_opt_in ?? true);
      chargerCommandes();
    } catch {
      setErreur('Erreur réseau.');
    } finally {
      setEnvoi(false);
    }
  }

  async function inscription(e: React.FormEvent) {
    e.preventDefault();
    setErreur('');
    setMsg('');
    setEnvoi(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ email, password, nom, telephone: tel, adresse, marketing_opt_in: optIn }),
      });
      const d = await res.json();
      if (!res.ok) return setErreur(d.erreur ?? 'Inscription échouée.');
      setUser(d.user);
      setMsg('Compte créé avec succès !');
      chargerCommandes();
    } catch {
      setErreur('Erreur réseau.');
    } finally {
      setEnvoi(false);
    }
  }

  async function sauvegarderProfil(e: React.FormEvent) {
    e.preventDefault();
    setErreur('');
    setMsg('');
    setEnvoi(true);
    try {
      const res = await fetch('/api/compte/profil', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ nom, telephone: tel, adresse, marketing_opt_in: optIn }),
      });
      const d = await res.json();
      if (!res.ok) return setErreur(d.erreur ?? 'Mise à jour impossible.');
      setUser(d.profile);
      try {
        const prev = JSON.parse(localStorage.getItem(CLE_CLIENT) ?? '{}');
        localStorage.setItem(CLE_CLIENT, JSON.stringify({ ...prev, nom: d.profile.nom, tel: tel || prev.tel || '', email: d.profile.email, adresse: d.profile.adresse ?? prev.adresse ?? '' }));
      } catch {
        /* ignore */
      }
      setMsg('Profil enregistré.');
    } catch {
      setErreur('Erreur réseau.');
    } finally {
      setEnvoi(false);
    }
  }

  async function deconnexion() {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' });
    setUser(null);
    setCommandes([]);
    setPassword('');
    window.location.reload();
  }

  async function envoyerLienMagique(e: React.FormEvent) {
    e.preventDefault();
    if (!magicEmail.trim()) return;
    setErreur('');
    setMsg('');
    setEnvoi(true);
    try {
      const res = await fetch('/api/auth/magic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: magicEmail.trim() }),
      });
      const d = await res.json().catch(() => null);
      if (!res.ok) return setErreur(d?.erreur ?? 'Envoi impossible.');
      setMsg(d?.message ?? 'Lien de connexion envoyé par email !');
      setMagicEmail('');
    } catch {
      setErreur('Erreur réseau.');
    } finally {
      setEnvoi(false);
    }
  }

  async function chercherSuivi(e: React.FormEvent) {
    e.preventDefault();
    setErreur('');
    setCmdSuivi(null);
    setEnvoi(true);
    try {
      const res = await fetch(`/api/suivi?ref=${encodeURIComponent(suiviRef.trim())}&tel=${encodeURIComponent(suiviTel.trim())}`);
      const d = await res.json();
      if (!res.ok) return setErreur(d.erreur ?? 'Commande introuvable.');
      setCmdSuivi(d.commande);
    } catch {
      setErreur('Erreur réseau.');
    } finally {
      setEnvoi(false);
    }
  }

  if (chargement) {
    return (
      <div className="mx-auto max-w-xl py-10">
        <div className="h-48 animate-pulse rounded-3xl bg-white" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-lg py-6">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="m-0 text-2xl font-extrabold tracking-tight">Mon compte & Suivi</h1>
          <Link href="/" className="text-sm font-bold text-primary underline">
            ← Accueil
          </Link>
        </div>

        <div className="grid grid-cols-3 gap-1.5 rounded-2xl bg-black/5 p-1">
          {([
            ['login', 'Connexion'],
            ['register', 'Inscription'],
            ['suivi', 'Suivi invité'],
          ] as const).map(([cle, label]) => (
            <button
              key={cle}
              type="button"
              onClick={() => {
                setOngletAuth(cle);
                setErreur('');
                setMsg('');
              }}
              className={`h-11 rounded-xl text-xs font-extrabold transition sm:text-sm ${
                ongletAuth === cle ? 'bg-white text-ink shadow-sm' : 'text-muted hover:text-ink'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {erreur && <p className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{erreur}</p>}
        {msg && <p className="mt-4 rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">{msg}</p>}

        {(ongletAuth === 'login' || ongletAuth === 'register') && (
          <div className="mt-4 flex flex-col gap-3 rounded-3xl border border-black/5 bg-white p-4 shadow-sm sm:p-5">
            <p className="m-0 text-xs font-extrabold uppercase tracking-wide text-muted">⚡ Connexion rapide (1 clic)</p>
            {googleActif ? (
              <a
                href="/api/auth/google"
                className="flex h-12 w-full items-center justify-center gap-2.5 rounded-2xl border border-black/15 bg-white text-sm font-extrabold text-ink shadow-sm transition hover:bg-[#f6f7fb]"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                  <path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47a5.53 5.53 0 0 1-2.4 3.63v3h3.88c2.27-2.09 3.54-5.17 3.54-8.87z" />
                  <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3c-1.08.72-2.45 1.15-4.05 1.15-3.12 0-5.77-2.11-6.72-4.96H1.29v3.1A12 12 0 0 0 12 24z" />
                  <path fill="#FBBC05" d="M5.28 14.28A7.2 7.2 0 0 1 4.9 12c0-.79.14-1.56.38-2.28v-3.1H1.29A12 12 0 0 0 0 12c0 1.94.46 3.77 1.29 5.38l3.99-3.1z" />
                  <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0A12 12 0 0 0 1.29 6.62l3.99 3.1c.95-2.85 3.6-4.97 6.72-4.97z" />
                </svg>
                Continuer avec Google
              </a>
            ) : (
              <button
                type="button"
                onClick={() => setMsg('Astuce : activez Google dans Supabase → Auth → Providers → Google pour activer ce bouton instantanément. En attendant, utilisez le lien magique 1 clic ci-dessous !')}
                className="flex h-12 w-full items-center justify-center gap-2.5 rounded-2xl border border-black/15 bg-white text-sm font-extrabold text-ink shadow-sm hover:bg-[#f6f7fb]"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                  <path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47a5.53 5.53 0 0 1-2.4 3.63v3h3.88c2.27-2.09 3.54-5.17 3.54-8.87z" />
                  <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3c-1.08.72-2.45 1.15-4.05 1.15-3.12 0-5.77-2.11-6.72-4.96H1.29v3.1A12 12 0 0 0 12 24z" />
                  <path fill="#FBBC05" d="M5.28 14.28A7.2 7.2 0 0 1 4.9 12c0-.79.14-1.56.38-2.28v-3.1H1.29A12 12 0 0 0 0 12c0 1.94.46 3.77 1.29 5.38l3.99-3.1z" />
                  <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0A12 12 0 0 0 1.29 6.62l3.99 3.1c.95-2.85 3.6-4.97 6.72-4.97z" />
                </svg>
                Continuer avec Google
              </button>
            )}

            <form onSubmit={envoyerLienMagique} className="flex gap-1.5">
              <input
                type="email"
                required
                value={magicEmail}
                onChange={(e) => setMagicEmail(e.target.value)}
                placeholder="Votre email → lien 1 clic sans mot de passe"
                className="h-11 flex-1 rounded-xl border border-black/10 bg-[#f6f7fb] px-3 text-xs font-semibold outline-none focus:border-primary sm:text-sm"
              />
              <button
                type="submit"
                disabled={envoi}
                className="h-11 shrink-0 rounded-xl bg-ink px-3.5 text-xs font-extrabold text-white disabled:opacity-50"
              >
                ⚡ 1 clic
              </button>
            </form>
          </div>
        )}

        {ongletAuth === 'login' && (
          <form onSubmit={connexion} className="mt-4 flex flex-col gap-3 rounded-3xl bg-white p-5 shadow-sm">
            <label className="text-sm font-bold">
              Email
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="vous@exemple.com" className={champ} />
            </label>
            <label className="text-sm font-bold">
              Mot de passe
              <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className={champ} />
            </label>
            <button
              type="submit"
              disabled={envoi}
              className="mt-2 h-12 rounded-2xl bg-primary text-base font-extrabold text-white hover:opacity-95 disabled:opacity-50"
            >
              {envoi ? 'Connexion…' : 'Se connecter'}
            </button>
            <p className="mt-1 text-center text-xs text-muted">
              Pas encore de compte ?{' '}
              <button type="button" onClick={() => setOngletAuth('register')} className="font-bold text-primary underline">
                Créer un compte
              </button>
            </p>
          </form>
        )}

        {ongletAuth === 'register' && (
          <form onSubmit={inscription} className="mt-4 flex flex-col gap-3 rounded-3xl bg-white p-5 shadow-sm">
            <label className="text-sm font-bold">
              Nom complet
              <input type="text" required value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Ex. Sami Ben Ali" className={champ} />
            </label>
            <label className="text-sm font-bold">
              Téléphone (8 chiffres)
              <input type="tel" required value={tel} onChange={(e) => setTel(e.target.value)} placeholder="22 123 456" className={champ} />
            </label>
            <label className="text-sm font-bold">
              Email
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="vous@exemple.com" className={champ} />
            </label>
            <label className="text-sm font-bold">
              Mot de passe (min. 6 caractères)
              <input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className={champ} />
            </label>
            <label className="text-sm font-bold">
              Adresse habituelle (facultatif)
              <input type="text" value={adresse} onChange={(e) => setAdresse(e.target.value)} placeholder="Ex. Route Gremda km 3, Sfax" className={champ} />
            </label>
            <label className="flex items-start gap-2.5 pt-1 text-xs font-medium text-muted">
              <input type="checkbox" checked={optIn} onChange={(e) => setOptIn(e.target.checked)} className="mt-0.5 h-4 w-4 accent-primary" />
              <span>Recevoir le suivi de mes commandes et les offres spéciales par email et WhatsApp.</span>
            </label>
            <button
              type="submit"
              disabled={envoi}
              className="mt-2 h-12 rounded-2xl bg-primary text-base font-extrabold text-white hover:opacity-95 disabled:opacity-50"
            >
              {envoi ? 'Création…' : 'Créer mon compte'}
            </button>
          </form>
        )}

        {ongletAuth === 'suivi' && (
          <div className="mt-4 flex flex-col gap-4">
            <form onSubmit={chercherSuivi} className="flex flex-col gap-3 rounded-3xl bg-white p-5 shadow-sm">
              <p className="m-0 text-sm text-muted">
                Commandé sans compte ? Retrouvez le statut en temps réel avec votre numéro de commande et votre téléphone.
              </p>
              <label className="text-sm font-bold">
                N° de commande
                <input type="text" required value={suiviRef} onChange={(e) => setSuiviRef(e.target.value.toUpperCase())} placeholder="Ex. TEST01" className={champ} />
              </label>
              <label className="text-sm font-bold">
                Numéro de téléphone utilisé
                <input type="tel" required value={suiviTel} onChange={(e) => setSuiviTel(e.target.value)} placeholder="22 111 222" className={champ} />
              </label>
              <button
                type="submit"
                disabled={envoi}
                className="mt-1 h-12 rounded-2xl bg-ink text-base font-extrabold text-white hover:opacity-90 disabled:opacity-50"
              >
                {envoi ? 'Recherche…' : 'Suivre ma commande'}
              </button>
            </form>
            {cmdSuivi && <CarteCommande c={cmdSuivi} guestRef={suiviRef.trim()} guestTel={suiviTel.trim()} />}
          </div>
        )}
      </div>
    );
  }

  const enCours = commandes.filter((c) => c.statut !== 'livree' && c.statut !== 'annulee');
  const terminees = commandes.filter((c) => c.statut === 'livree' || c.statut === 'annulee');
  const initiales = (user.nom || user.email || 'CL')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('') || 'CL';

  return (
    <div className="mx-auto max-w-2xl py-6">
      <div className="rounded-3xl bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3.5">
            <div className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-ink text-lg font-extrabold text-white">
              {initiales}
            </div>
            <div className="min-w-0">
              <h1 className="m-0 truncate text-xl font-extrabold text-ink">{user.nom || user.email}</h1>
              <p className="m-0 truncate text-xs text-muted">{user.email}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {(user.role === 'admin' || user.role === 'livreur') && (
              <Link href="/admin" className="flex h-10 items-center rounded-xl bg-ink px-4 text-xs font-extrabold text-white hover:opacity-90">
                Ouvrir Admin →
              </Link>
            )}
            <button
              type="button"
              onClick={deconnexion}
              className="h-10 rounded-xl border border-black/10 px-3.5 text-xs font-bold text-ink hover:bg-black/5"
            >
              Déconnexion
            </button>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Link
            href="/commandes"
            className="inline-flex items-center gap-2 rounded-full bg-[#f1f3f9] px-3.5 py-1.5 text-xs font-bold text-ink hover:bg-black/10"
          >
            <span className={`h-2 w-2 rounded-full ${enCours.length > 0 ? 'bg-primary' : 'bg-black/30'}`} />
            {enCours.length} {enCours.length > 1 ? 'commandes en cours' : 'commande en cours'}
          </Link>
        </div>
      </div>

      {/* Liens rapides style application (2x2 cartes blanches arrondies) */}
      <div className="mt-4 grid grid-cols-2 gap-2.5">
        <Link
          href="/commandes"
          className="flex flex-col items-start gap-2 rounded-3xl border border-black/5 bg-white p-4 shadow-sm transition hover:border-primary/30"
        >
          <span className="grid h-10 w-10 place-items-center rounded-2xl bg-[#f1f5ff] text-lg text-primary">🧾</span>
          <div>
            <p className="m-0 text-sm font-extrabold text-ink">Historique des commandes</p>
            <p className="m-0 text-xs text-muted">{commandes.length} commande(s)</p>
          </div>
        </Link>
        <button
          type="button"
          onClick={() => setOngletCompte('parrainage')}
          className={`flex flex-col items-start gap-2 rounded-3xl border p-4 text-left shadow-sm transition ${
            ongletCompte === 'parrainage' ? 'border-primary bg-primary/5' : 'border-black/5 bg-white hover:border-primary/30'
          }`}
        >
          <span className="grid h-10 w-10 place-items-center rounded-2xl bg-[#f1f5ff] text-lg text-primary">🎁</span>
          <div>
            <p className="m-0 text-sm font-extrabold text-ink">Parrainage &amp; Crédit</p>
            <p className="m-0 text-xs text-muted">Gagnez du crédit</p>
          </div>
        </button>
        <button
          type="button"
          onClick={() => setOngletCompte('support')}
          className={`flex flex-col items-start gap-2 rounded-3xl border p-4 text-left shadow-sm transition ${
            ongletCompte === 'support' ? 'border-primary bg-primary/5' : 'border-black/5 bg-white hover:border-primary/30'
          }`}
        >
          <span className="grid h-10 w-10 place-items-center rounded-2xl bg-[#f1f5ff] text-lg text-primary">💬</span>
          <div>
            <p className="m-0 text-sm font-extrabold text-ink">Support client</p>
            <p className="m-0 text-xs text-muted">Aide et contact</p>
          </div>
        </button>
        <button
          type="button"
          onClick={() => setOngletCompte('adresses')}
          className={`flex flex-col items-start gap-2 rounded-3xl border p-4 text-left shadow-sm transition ${
            ongletCompte === 'adresses' ? 'border-primary bg-primary/5' : 'border-black/5 bg-white hover:border-primary/30'
          }`}
        >
          <span className="grid h-10 w-10 place-items-center rounded-2xl bg-[#f1f5ff] text-lg text-primary">📍</span>
          <div>
            <p className="m-0 text-sm font-extrabold text-ink">Mes adresses</p>
            <p className="m-0 text-xs text-muted">{adresses.length} enregistrée(s)</p>
          </div>
        </button>
      </div>

      <div className="mt-4">
        <ReseauxSociaux variante="carte" />
      </div>

      <div className="no-scrollbar mt-4 flex gap-1.5 overflow-x-auto rounded-2xl bg-black/5 p-1">
        {([
          ['commandes', `📦 Commandes (${commandes.length})`],
          ['parrainage', '🎁 Parrainage'],
          ['adresses', `📍 Adresses (${adresses.length})`],
          ['support', '🎧 Aide'],
          ['profil', '👤 Profil'],
        ] as const).map(([cle, label]) => (
          <button
            key={cle}
            type="button"
            onClick={() => setOngletCompte(cle)}
            className={`h-11 shrink-0 flex-1 whitespace-nowrap rounded-xl px-3 text-xs font-extrabold transition sm:text-sm ${
              ongletCompte === cle ? 'bg-white text-ink shadow-sm' : 'text-muted hover:text-ink'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {erreur && <p className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{erreur}</p>}
      {msg && <p className="mt-4 rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">{msg}</p>}

      {ongletCompte === 'parrainage' && <ParrainagePanel />}
      {ongletCompte === 'support' && <SupportPanel />}

      {ongletCompte === 'commandes' && (
        <div className="mt-4 flex flex-col gap-5">
          <div className="flex items-center justify-between">
            <h2 className="m-0 text-base font-extrabold">En cours ({enCours.length})</h2>
            <button type="button" onClick={chargerCommandes} className="text-xs font-bold text-primary underline">
              Actualiser
            </button>
          </div>
          {enCours.length ? (
            <div className="flex flex-col gap-3">
              {enCours.map((c) => (
                <CarteCommande key={c.id} c={c} />
              ))}
            </div>
          ) : (
            <div className="rounded-3xl bg-white p-6 text-center text-sm text-muted">
              Aucune commande en cours.{' '}
              <Link href="/c/restaurants" className="font-bold text-primary underline">
                Découvrir les restaurants
              </Link>
            </div>
          )}

          {terminees.length > 0 && (
            <>
              <h2 className="m-0 text-base font-extrabold">Historique ({terminees.length})</h2>
              <div className="flex flex-col gap-3">
                {terminees.map((c) => (
                  <CarteCommande key={c.id} c={c} />
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {ongletCompte === 'adresses' && (
        <div className="mt-4 flex flex-col gap-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!adrTexte.trim()) return;
              const next = ajouterAdresse(adrLabel, adrTexte, adrDetail);
              setAdresses(next);
              if (next.length === 1) synchroniserAdresseActive(next[0].adresse);
              setAdrTexte('');
              setAdrDetail('');
              setMsg('Adresse enregistrée.');
            }}
            className="flex flex-col gap-3 rounded-3xl bg-white p-5 shadow-sm"
          >
            <h2 className="m-0 text-base font-extrabold">Ajouter une adresse</h2>
            <div className="grid grid-cols-3 gap-1.5">
              {(['Maison', 'Travail', 'Autre'] as const).map((lbl) => (
                <button
                  key={lbl}
                  type="button"
                  onClick={() => setAdrLabel(lbl)}
                  className={`h-10 rounded-xl border text-xs font-extrabold ${
                    adrLabel === lbl ? 'border-primary bg-primary/10 text-primary' : 'border-black/10 bg-white text-ink'
                  }`}
                >
                  {lbl === 'Maison' ? '🏠 Maison' : lbl === 'Travail' ? '💼 Travail' : '📍 Autre'}
                </button>
              ))}
            </div>
            <input
              type="text"
              required
              value={adrTexte}
              onChange={(e) => setAdrTexte(e.target.value)}
              placeholder="Rue, quartier, repère (ex. Route Gremda km 3…)"
              className={champ}
            />
            <input
              type="text"
              value={adrDetail}
              onChange={(e) => setAdrDetail(e.target.value)}
              placeholder="Étage, porte, code (optionnel)"
              className={champ}
            />
            <button type="submit" className="h-11 rounded-2xl bg-primary text-sm font-extrabold text-white">
              + Enregistrer cette adresse
            </button>
          </form>

          {adresses.length === 0 ? (
            <div className="rounded-3xl bg-white p-6 text-center text-xs text-muted">
              Aucune adresse enregistrée pour le moment.
            </div>
          ) : (
            <div className="flex flex-col gap-2.5">
              {adresses.map((a) => (
                <div
                  key={a.id}
                  className={`flex items-start justify-between gap-3 rounded-3xl border p-4 shadow-sm ${
                    a.defaut ? 'border-primary bg-primary/5' : 'border-black/5 bg-white'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-extrabold text-ink">
                        {a.label === 'Maison' ? '🏠' : a.label === 'Travail' ? '💼' : '📍'} {a.label}
                      </span>
                      {a.defaut && (
                        <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-extrabold text-white">
                          Par défaut
                        </span>
                      )}
                    </div>
                    <p className="m-0 mt-1 text-xs font-semibold text-ink">{a.adresse}</p>
                    {a.detail && <p className="m-0 mt-0.5 text-xs text-muted">{a.detail}</p>}
                  </div>
                  <div className="flex shrink-0 flex-col gap-1">
                    {!a.defaut && (
                      <button
                        type="button"
                        onClick={() => {
                          setAdresses(definirAdresseDefaut(a.id));
                          synchroniserAdresseActive(a.adresse);
                          setMsg(`Adresse « ${a.label} » définie par défaut.`);
                        }}
                        className="rounded-xl bg-ink px-2.5 py-1.5 text-[11px] font-extrabold text-white"
                      >
                        Utiliser
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setAdresses(supprimerAdresse(a.id))}
                      className="rounded-xl border border-black/10 px-2.5 py-1 text-[11px] font-bold text-red-700"
                    >
                      Supprimer
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {ongletCompte === 'profil' && (
        <form onSubmit={sauvegarderProfil} className="mt-4 flex flex-col gap-3 rounded-3xl bg-white p-5 shadow-sm">
          <label className="text-sm font-bold">
            Nom complet
            <input type="text" required value={nom} onChange={(e) => setNom(e.target.value)} className={champ} />
          </label>
          <label className="text-sm font-bold">
            Téléphone (8 chiffres)
            <input type="tel" value={tel} onChange={(e) => setTel(e.target.value)} placeholder="22 123 456" className={champ} />
          </label>
          <label className="text-sm font-bold">
            Adresse par défaut
            <input type="text" value={adresse} onChange={(e) => setAdresse(e.target.value)} placeholder="Votre adresse de livraison" className={champ} />
          </label>
          <label className="flex items-start gap-2.5 pt-1 text-xs font-medium text-muted">
            <input type="checkbox" checked={optIn} onChange={(e) => setOptIn(e.target.checked)} className="mt-0.5 h-4 w-4 accent-primary" />
            <span>Recevoir les offres, promos et notifications par email et WhatsApp.</span>
          </label>
          <button
            type="submit"
            disabled={envoi}
            className="mt-2 h-12 rounded-2xl bg-primary text-base font-extrabold text-white hover:opacity-95 disabled:opacity-50"
          >
            {envoi ? 'Enregistrement…' : 'Enregistrer mon profil'}
          </button>
        </form>
      )}
    </div>
  );
}
