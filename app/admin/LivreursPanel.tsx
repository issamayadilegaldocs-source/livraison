'use client';

import { useState } from 'react';
import type { BilanLivreur, LivreurGestion } from '@/lib/plateforme';

const vide = {
  id: '',
  nom: '',
  telephone: '',
  email: '',
  password: '',
  ville: 'Sfax',
  vehicule: 'Moto',
  commission_type: 'fixe' as 'fixe' | 'pourcent',
  commission_valeur: '1',
  notes: '',
  actif: true,
  disponible: true,
};

const fmtPrix = (n: number) => `${Number(n || 0).toFixed(3).replace('.', ',')} DT`;

export default function LivreursPanel({
  livreurs,
  bilan,
  totalARecuperer,
  onReload,
  mode = 'pc',
}: {
  livreurs: LivreurGestion[];
  bilan: Record<string, BilanLivreur>;
  totalARecuperer: number;
  onReload: () => Promise<void>;
  mode?: 'pc' | 'mobile';
}) {
  const [form, setForm] = useState(vide);
  const [ouvert, setOuvert] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const [reglementBusy, setReglementBusy] = useState<string | null>(null);
  const [erreur, setErreur] = useState('');
  const [succes, setSucces] = useState('');

  async function enregistrer(e: React.FormEvent) {
    e.preventDefault();
    setErreur('');
    setSucces('');
    setEnvoi(true);
    try {
      const val = Math.max(0, Number(String(form.commission_valeur).replace(',', '.')) || 0);
      const res = await fetch('/api/admin/livreurs', {
        method: form.id ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          ...(form.id ? { id: form.id } : {}),
          nom: form.nom,
          telephone: form.telephone,
          email: form.email,
          ...(form.password.trim() ? { password: form.password.trim() } : {}),
          ville: form.ville,
          vehicule: form.vehicule,
          commission_type: form.commission_type,
          commission_valeur: val,
          notes: form.notes,
          actif: form.actif,
          disponible: form.disponible,
        }),
      });
      const d = await res.json();
      if (!res.ok) return setErreur(d.erreur ?? 'Erreur enregistrement.');
      setSucces(
        d.compteCree
          ? `✓ Sous-livreur « ${form.nom} » créé avec son compte (${form.email}). Il recevra un email + notification à chaque commande affectée.`
          : `✓ Livreur « ${form.nom} » enregistré.`,
      );
      setForm(vide);
      setOuvert(false);
      await onReload();
    } catch {
      setErreur('Erreur réseau.');
    } finally {
      setEnvoi(false);
    }
  }

  async function marquerRegle(l: LivreurGestion, montant: number) {
    if (!confirm(`Confirmer que ${l.nom} vous a payé ${fmtPrix(montant)} ?`)) return;
    setReglementBusy(l.id);
    setSucces('');
    try {
      const res = await fetch('/api/admin/reglement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ livreur_id: l.id }),
      });
      const d = await res.json().catch(() => null);
      if (res.ok && d) {
        setSucces(`✓ Règlement enregistré : ${fmtPrix(d.montant_regle)} encaissés de ${l.nom} (${d.nb_reglees} course(s) soldée(s)).`);
        await onReload();
      }
    } finally {
      setReglementBusy(null);
    }
  }

  async function basculer(l: LivreurGestion, champ: 'actif' | 'disponible') {
    await fetch('/api/admin/livreurs', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({
        id: l.id,
        nom: l.nom,
        telephone: l.telephone,
        email: l.email ?? '',
        ville: l.ville,
        vehicule: l.vehicule ?? '',
        commission_type: l.commission_type ?? 'fixe',
        commission_valeur: Number(l.commission_valeur ?? 1),
        notes: l.notes ?? '',
        actif: champ === 'actif' ? !l.actif : l.actif,
        disponible: champ === 'disponible' ? !l.disponible : l.disponible,
      }),
    });
    await onReload();
  }

  async function supprimer(id: string) {
    if (!confirm('Supprimer ce livreur ?')) return;
    await fetch(`/api/admin/livreurs?id=${encodeURIComponent(id)}`, { method: 'DELETE', credentials: 'same-origin' });
    await onReload();
  }

  const exempleVal = Math.max(0, Number(String(form.commission_valeur).replace(',', '.')) || 0);
  const exempleGain = form.commission_type === 'pourcent' ? (20 * Math.min(100, exempleVal)) / 100 : exempleVal;

  return (
    <div className="flex flex-col gap-4">
      {/* Carte résumé des gains à récupérer sur l'équipe */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl bg-emerald-700 p-5 text-white shadow-sm">
        <div>
          <p className="m-0 text-xs font-bold uppercase tracking-wide text-white/80">Caisse équipe sous-livreurs</p>
          <p className="m-0 mt-1 text-2xl font-extrabold sm:text-3xl">À récupérer : {fmtPrix(totalARecuperer)}</p>
          <p className="m-0 mt-0.5 text-xs text-white/85">
            Votre part cumulée sur les courses livrées par vos sous-livreurs (non encore réglées).
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setForm(vide);
            setOuvert((v) => !v);
            setErreur('');
            setSucces('');
          }}
          className="h-11 rounded-2xl bg-white px-4 text-xs font-extrabold text-emerald-900 shadow-sm"
        >
          {ouvert ? 'Fermer le formulaire' : '+ Ajouter un sous-livreur'}
        </button>
      </div>

      {succes && <p className="m-0 rounded-2xl bg-emerald-50 px-4 py-3 text-xs font-extrabold text-emerald-800">{succes}</p>}

      {ouvert && (
        <form onSubmit={enregistrer} className="grid gap-3 rounded-3xl border border-black/5 bg-white p-4 shadow-sm sm:grid-cols-2 sm:p-5">
          {erreur && <p className="m-0 rounded-xl bg-red-50 px-3 py-2 text-xs font-bold text-red-700 sm:col-span-2">{erreur}</p>}
          <label className="text-xs font-bold">
            Nom du livreur *
            <input required value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} placeholder="Ex. Karim Livreur" className="mt-1 w-full rounded-xl border border-black/10 px-3 py-2.5 text-sm" />
          </label>
          <label className="text-xs font-bold">
            Téléphone / WhatsApp (8 chiffres) *
            <input required value={form.telephone} onChange={(e) => setForm({ ...form, telephone: e.target.value })} placeholder="55 111 222" className="mt-1 w-full rounded-xl border border-black/10 px-3 py-2.5 text-sm" />
          </label>
          <label className="text-xs font-bold">
            Email (connexion + notifications)
            <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="karim@livraison.tn" className="mt-1 w-full rounded-xl border border-black/10 px-3 py-2.5 text-sm" />
          </label>
          <label className="text-xs font-bold">
            Mot de passe {form.id ? '(laisser vide pour garder l’actuel)' : '(min. 6 caractères)'}
            <input type="password" minLength={6} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="••••••••" className="mt-1 w-full rounded-xl border border-black/10 px-3 py-2.5 text-sm" />
          </label>

          {/* Règle de gain Admin sur ce sous-livreur */}
          <div className="rounded-2xl bg-[#f6f7fb] p-3.5 sm:col-span-2">
            <p className="m-0 text-xs font-extrabold text-ink">💰 Combien vous gagnez sur chaque course livrée par ce sous-livreur :</p>
            <div className="mt-2 grid gap-2.5 sm:grid-cols-2">
              <label className="text-xs font-bold">
                Mode de calcul
                <select
                  value={form.commission_type}
                  onChange={(e) => setForm({ ...form, commission_type: e.target.value as 'fixe' | 'pourcent' })}
                  className="mt-1 w-full rounded-xl border border-black/10 bg-white px-3 py-2.5 text-sm"
                >
                  <option value="fixe">Montant fixe par course (DT)</option>
                  <option value="pourcent">Pourcentage sur la commande (%)</option>
                </select>
              </label>
              <label className="text-xs font-bold">
                Valeur ({form.commission_type === 'fixe' ? 'DT par course' : '% du total'})
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={form.commission_valeur}
                  onChange={(e) => setForm({ ...form, commission_valeur: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-black/10 bg-white px-3 py-2.5 text-sm"
                />
              </label>
            </div>
            <p className="m-0 mt-2 text-xs font-semibold text-emerald-800">
              Exemple : sur une commande à 20 DT livrée par {form.nom || 'ce livreur'}, votre part est de <b>{fmtPrix(exempleGain)}</b>.
            </p>
          </div>

          <label className="text-xs font-bold">
            Véhicule
            <input value={form.vehicule} onChange={(e) => setForm({ ...form, vehicule: e.target.value })} placeholder="Moto, Scooter, Voiture…" className="mt-1 w-full rounded-xl border border-black/10 px-3 py-2.5 text-sm" />
          </label>
          <label className="text-xs font-bold">
            Notes
            <input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Zone couverte…" className="mt-1 w-full rounded-xl border border-black/10 px-3 py-2.5 text-sm" />
          </label>
          <div className="flex items-center justify-end gap-2 sm:col-span-2">
            <button type="button" onClick={() => setOuvert(false)} className="h-10 rounded-xl border border-black/10 px-4 text-xs font-bold">
              Annuler
            </button>
            <button type="submit" disabled={envoi} className="h-10 rounded-xl bg-primary px-5 text-xs font-extrabold text-white">
              {envoi ? 'Enregistrement…' : form.id ? 'Enregistrer' : 'Créer le sous-livreur'}
            </button>
          </div>
        </form>
      )}

      {mode === 'pc' ? (
        <div className="overflow-x-auto rounded-3xl border border-black/5 bg-white p-4 shadow-sm">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-black/10 text-[11px] font-extrabold uppercase text-muted">
                <th className="py-2.5 pr-3">Livreur</th>
                <th className="py-2.5 pr-3">Ta part</th>
                <th className="py-2.5 pr-3">Courses livrées</th>
                <th className="py-2.5 pr-3">À récupérer</th>
                <th className="py-2.5 pr-3">Statut</th>
                <th className="py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {livreurs.map((l) => {
                const b = bilan[l.id];
                const aRecup = b?.a_recuperer ?? 0;
                const regle = (l.commission_type ?? 'fixe') === 'pourcent'
                  ? `${Number(l.commission_valeur ?? 0)} %`
                  : `${fmtPrix(Number(l.commission_valeur ?? 1))} / course`;
                return (
                  <tr key={l.id} className="border-b border-black/5 hover:bg-[#f8f9fc]">
                    <td className="py-3 pr-3">
                      <div className="font-extrabold text-ink">{l.nom}</div>
                      <div className="text-[11px] text-muted">+{l.telephone}{l.email ? ` · ${l.email}` : ''}</div>
                    </td>
                    <td className="py-3 pr-3 font-bold text-ink">{regle}</td>
                    <td className="py-3 pr-3">
                      <div className="font-extrabold">{b?.nb_livrees_aujourdhui ?? 0} auj. · {b?.nb_livrees_total ?? 0} total</div>
                      <div className="text-[11px] text-muted">CA : {fmtPrix(b?.ca_total ?? 0)}</div>
                    </td>
                    <td className="py-3 pr-3">
                      <div className={`text-sm font-extrabold ${aRecup > 0 ? 'text-emerald-700' : 'text-muted'}`}>{fmtPrix(aRecup)}</div>
                      {(b?.deja_recupere ?? 0) > 0 && <div className="text-[10px] text-muted">Déjà réglé : {fmtPrix(b!.deja_recupere)}</div>}
                    </td>
                    <td className="py-3 pr-3">
                      <div className="flex flex-wrap gap-1">
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold ${l.actif ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-700'}`}>{l.actif ? 'Actif' : 'Inactif'}</span>
                        {l.user_id && <span className="rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-extrabold text-purple-800">🔑 Compte</span>}
                      </div>
                    </td>
                    <td className="py-3 text-right">
                      <div className="inline-flex flex-wrap justify-end gap-1">
                        {aRecup > 0 && (
                          <button
                            type="button"
                            disabled={reglementBusy === l.id}
                            onClick={() => marquerRegle(l, aRecup)}
                            className="rounded-lg bg-emerald-600 px-2.5 py-1 font-extrabold text-white"
                          >
                            ✅ Réglé
                          </button>
                        )}
                        <button type="button" onClick={() => basculer(l, 'disponible')} className="rounded-lg border border-black/10 bg-white px-2 py-1 font-bold">{l.disponible ? 'Dispo' : 'Occupé'}</button>
                        <button
                          type="button"
                          onClick={() => {
                            setForm({
                              id: l.id,
                              nom: l.nom,
                              telephone: l.telephone.replace(/^216/, ''),
                              email: l.email ?? '',
                              password: '',
                              ville: l.ville,
                              vehicule: l.vehicule ?? '',
                              commission_type: l.commission_type ?? 'fixe',
                              commission_valeur: String(l.commission_valeur ?? 1),
                              notes: l.notes ?? '',
                              actif: l.actif,
                              disponible: l.disponible,
                            });
                            setOuvert(true);
                            setSucces('');
                          }}
                          className="rounded-lg bg-ink px-2.5 py-1 font-extrabold text-white"
                        >
                          Modifier
                        </button>
                        <button type="button" onClick={() => supprimer(l.id)} className="rounded-lg bg-red-50 px-2 py-1 font-bold text-red-700">Suppr.</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {livreurs.map((l) => {
            const b = bilan[l.id];
            const aRecup = b?.a_recuperer ?? 0;
            const regle = (l.commission_type ?? 'fixe') === 'pourcent'
              ? `${Number(l.commission_valeur ?? 0)} % par commande`
              : `${fmtPrix(Number(l.commission_valeur ?? 1))} par course`;
            return (
              <div key={l.id} className="flex flex-col gap-3 rounded-3xl border border-black/5 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-base font-extrabold text-ink">{l.nom}</span>
                      {l.user_id && <span className="rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-extrabold text-purple-800">🔑 Compte</span>}
                    </div>
                    <p className="m-0 mt-0.5 text-xs text-muted">📞 +{l.telephone} · Ta part : <b>{regle}</b></p>
                  </div>
                  <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-extrabold ${l.disponible ? 'bg-blue-100 text-blue-800' : 'bg-amber-100 text-amber-800'}`}>
                    {l.disponible ? 'Dispo' : 'Occupé'}
                  </span>
                </div>

                {/* Caisse du sous-livreur */}
                <div className="flex items-center justify-between gap-2 rounded-2xl bg-[#f6f7fb] p-3">
                  <div>
                    <p className="m-0 text-[11px] font-bold text-muted">À récupérer ({b?.nb_non_reglees ?? 0} course(s))</p>
                    <p className={`m-0 text-lg font-extrabold ${aRecup > 0 ? 'text-emerald-700' : 'text-ink'}`}>{fmtPrix(aRecup)}</p>
                    <p className="m-0 text-[11px] text-muted">{b?.nb_livrees_aujourdhui ?? 0} livrée(s) auj. · {b?.nb_livrees_total ?? 0} total</p>
                  </div>
                  {aRecup > 0 && (
                    <button
                      type="button"
                      disabled={reglementBusy === l.id}
                      onClick={() => marquerRegle(l, aRecup)}
                      className="h-11 rounded-2xl bg-emerald-600 px-4 text-xs font-extrabold text-white"
                    >
                      ✅ Marquer réglé
                    </button>
                  )}
                </div>

                <div className="flex flex-wrap gap-1.5">
                  <button type="button" onClick={() => basculer(l, 'disponible')} className="h-9 rounded-xl border border-black/10 px-3 text-xs font-bold">{l.disponible ? 'Mettre occupé' : 'Mettre dispo'}</button>
                  <button
                    type="button"
                    onClick={() => {
                      setForm({
                        id: l.id,
                        nom: l.nom,
                        telephone: l.telephone.replace(/^216/, ''),
                        email: l.email ?? '',
                        password: '',
                        ville: l.ville,
                        vehicule: l.vehicule ?? '',
                        commission_type: l.commission_type ?? 'fixe',
                        commission_valeur: String(l.commission_valeur ?? 1),
                        notes: l.notes ?? '',
                        actif: l.actif,
                        disponible: l.disponible,
                      });
                      setOuvert(true);
                      setSucces('');
                    }}
                    className="h-9 rounded-xl bg-ink px-3 text-xs font-extrabold text-white"
                  >
                    Modifier
                  </button>
                  <button type="button" onClick={() => supprimer(l.id)} className="h-9 rounded-xl bg-red-50 px-3 text-xs font-extrabold text-red-700">Suppr.</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
