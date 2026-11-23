'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from '@/app/components/Lien';
import CarteCommandeClient, { type CommandeClient } from '@/app/components/CarteCommandeClient';

export default function PageCommandes() {
  const [chargement, setChargement] = useState(true);
  const [connecte, setConnecte] = useState(false);
  const [role, setRole] = useState<string>('client');
  const [commandes, setCommandes] = useState<CommandeClient[]>([]);
  const [onglet, setOnglet] = useState<'en_cours' | 'historique'>('en_cours');

  // Suivi rapide invité (N° + téléphone)
  const [suiviRef, setSuiviRef] = useState('');
  const [suiviTel, setSuiviTel] = useState('');
  const [cmdSuivi, setCmdSuivi] = useState<CommandeClient | null>(null);
  const [errSuivi, setErrSuivi] = useState('');
  const [envoi, setEnvoi] = useState(false);

  const chargerCommandes = useCallback(async () => {
    const r = await fetch('/api/compte/commandes', { credentials: 'same-origin' }).catch(() => null);
    if (r && r.ok) {
      const d = await r.json();
      setCommandes(d.commandes ?? []);
    }
  }, []);

  useEffect(() => {
    fetch('/api/auth/me', { credentials: 'same-origin' })
      .then((r) => (r.ok ? r.json() : { user: null }))
      .then((d) => {
        if (d?.user) {
          setConnecte(true);
          setRole(d.user.role || 'client');
          return chargerCommandes();
        }
      })
      .finally(() => setChargement(false));
  }, [chargerCommandes]);

  useEffect(() => {
    if (!connecte) return;
    const t = setInterval(() => {
      if (!document.hidden) chargerCommandes();
    }, 8000);
    return () => clearInterval(t);
  }, [connecte, chargerCommandes]);

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

  async function chercherSuivi(e: React.FormEvent) {
    e.preventDefault();
    setErrSuivi('');
    setCmdSuivi(null);
    setEnvoi(true);
    try {
      const res = await fetch(`/api/suivi?ref=${encodeURIComponent(suiviRef.trim())}&tel=${encodeURIComponent(suiviTel.trim())}`);
      const d = await res.json().catch(() => null);
      if (!res.ok) return setErrSuivi(d?.erreur ?? 'Commande introuvable.');
      setCmdSuivi(d.commande);
    } catch {
      setErrSuivi('Erreur réseau.');
    } finally {
      setEnvoi(false);
    }
  }

  const enCours = commandes.filter((c) => c.statut !== 'livree' && c.statut !== 'annulee');
  const historique = commandes.filter((c) => c.statut === 'livree' || c.statut === 'annulee');

  return (
    <div className="mx-auto max-w-2xl py-5">
      <div className="mb-4 flex items-center justify-between gap-2">
        <div>
          <h1 className="m-0 text-2xl font-extrabold tracking-tight">Mes commandes</h1>
          <p className="m-0 mt-0.5 text-xs text-muted">Suivi en direct, carte GPS, chat livreur et historique.</p>
        </div>
        {connecte && (role === 'admin' || role === 'livreur') && (
          <Link href="/admin" className="rounded-xl bg-ink px-3.5 py-2 text-xs font-extrabold text-white">
            Espace Admin →
          </Link>
        )}
      </div>

      {chargement ? (
        <div className="h-44 animate-pulse rounded-3xl bg-white" />
      ) : connecte ? (
        <>
          {/* Onglets En cours / Historique (parité MyOrders hamma-app) */}
          <div className="grid grid-cols-2 gap-1.5 rounded-2xl bg-black/5 p-1">
            <button
              type="button"
              onClick={() => setOnglet('en_cours')}
              className={`h-11 rounded-xl text-sm font-extrabold transition ${
                onglet === 'en_cours' ? 'bg-white text-primary shadow-sm' : 'text-muted hover:text-ink'
              }`}
            >
              🛵 En cours ({enCours.length})
            </button>
            <button
              type="button"
              onClick={() => setOnglet('historique')}
              className={`h-11 rounded-xl text-sm font-extrabold transition ${
                onglet === 'historique' ? 'bg-white text-primary shadow-sm' : 'text-muted hover:text-ink'
              }`}
            >
              📜 Historique ({historique.length})
            </button>
          </div>

          <div className="mt-4 flex flex-col gap-3">
            {onglet === 'en_cours' ? (
              enCours.length > 0 ? (
                enCours.map((c) => <CarteCommandeClient key={c.id} c={c} />)
              ) : (
                <div className="rounded-3xl border border-black/5 bg-white p-8 text-center shadow-sm">
                  <p className="m-0 text-4xl">🛵</p>
                  <p className="m-0 mt-2 text-base font-extrabold text-ink">Aucune commande en cours</p>
                  <p className="m-0 mt-1 text-xs text-muted">
                    Commandez dans votre restaurant préféré et suivez votre livreur en direct ici.
                  </p>
                  <Link
                    href="/c/restaurants"
                    className="mt-4 inline-flex h-11 items-center rounded-2xl bg-primary px-5 text-sm font-extrabold text-white"
                  >
                    Voir les restaurants
                  </Link>
                </div>
              )
            ) : historique.length > 0 ? (
              historique.map((c) => <CarteCommandeClient key={c.id} c={c} />)
            ) : (
              <div className="rounded-3xl border border-black/5 bg-white p-8 text-center shadow-sm">
                <p className="m-0 text-4xl">📜</p>
                <p className="m-0 mt-2 text-base font-extrabold text-ink">Historique vide</p>
                <p className="m-0 mt-1 text-xs text-muted">Vos commandes livrées ou annulées apparaîtront ici.</p>
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="rounded-3xl border border-black/5 bg-white p-5 shadow-sm">
            <h2 className="m-0 text-base font-extrabold text-ink">Retrouver toutes vos commandes</h2>
            <p className="m-0 mt-1 text-xs text-muted">
              Connectez-vous pour voir vos commandes en cours, votre historique, vos favoris et votre crédit parrainage.
            </p>
            <Link
              href="/compte"
              className="mt-3 inline-flex h-11 items-center rounded-2xl bg-primary px-5 text-sm font-extrabold text-white"
            >
              Se connecter / Créer un compte
            </Link>
          </div>

          <form onSubmit={chercherSuivi} className="flex flex-col gap-3 rounded-3xl border border-black/5 bg-white p-5 shadow-sm">
            <h2 className="m-0 text-base font-extrabold text-ink">🔍 Suivi rapide sans compte</h2>
            <p className="m-0 text-xs text-muted">Entrez le numéro de commande reçu et votre téléphone pour suivre votre livreur en direct.</p>
            {errSuivi && <p className="m-0 rounded-xl bg-red-50 px-3 py-2 text-xs font-bold text-red-700">{errSuivi}</p>}
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <input
                required
                value={suiviRef}
                onChange={(e) => setSuiviRef(e.target.value.toUpperCase())}
                placeholder="N° de commande (ex. TEST01)"
                className="h-11 rounded-xl border border-black/10 px-3.5 text-sm font-bold uppercase outline-none focus:border-primary"
              />
              <input
                required
                type="tel"
                value={suiviTel}
                onChange={(e) => setSuiviTel(e.target.value)}
                placeholder="Téléphone (ex. 22111222)"
                className="h-11 rounded-xl border border-black/10 px-3.5 text-sm outline-none focus:border-primary"
              />
            </div>
            <button
              type="submit"
              disabled={envoi}
              className="h-11 rounded-2xl bg-ink text-sm font-extrabold text-white disabled:opacity-50"
            >
              {envoi ? 'Recherche…' : 'Suivre ma commande'}
            </button>
          </form>

          {cmdSuivi && <CarteCommandeClient c={cmdSuivi} guestRef={suiviRef.trim()} guestTel={suiviTel.trim()} />}
        </div>
      )}
    </div>
  );
}
