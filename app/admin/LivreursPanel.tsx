'use client';

import { useState } from 'react';
import type { LivreurGestion } from '@/lib/plateforme';

const vide = { id: '', nom: '', telephone: '', email: '', password: '', ville: 'Sfax', vehicule: 'Moto', notes: '', actif: true, disponible: true };

export default function LivreursPanel({
  livreurs,
  onReload,
  mode = 'pc',
}: {
  livreurs: LivreurGestion[];
  onReload: () => Promise<void>;
  mode?: 'pc' | 'mobile';
}) {
  const [form, setForm] = useState(vide);
  const [ouvert, setOuvert] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState('');
  const [succes, setSucces] = useState('');

  async function enregistrer(e: React.FormEvent) {
    e.preventDefault();
    setErreur('');
    setSucces('');
    setEnvoi(true);
    try {
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
          notes: form.notes,
          actif: form.actif,
          disponible: form.disponible,
        }),
      });
      const d = await res.json();
      if (!res.ok) return setErreur(d.erreur ?? 'Erreur enregistrement.');
      setSucces(
        d.compteCree
          ? `✓ Sous-livreur « ${form.nom} » enregistré avec son compte de connexion (${form.email}). Il peut se connecter sur /admin et recevra les emails + alertes Push à chaque commande affectée.`
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

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="m-0 text-base font-extrabold">🛵 Équipe & Sous-livreurs ({livreurs.length})</h2>
          <p className="m-0 text-xs text-muted">Ajoutez vos sous-livreurs avec leur email et mot de passe pour qu’ils suivent leurs commandes affectées et reçoivent leurs notifications.</p>
        </div>
        <button
          type="button"
          onClick={() => {
            setForm(vide);
            setOuvert((v) => !v);
            setErreur('');
            setSucces('');
          }}
          className="h-10 rounded-xl bg-primary px-4 text-xs font-extrabold text-white"
        >
          {ouvert ? 'Fermer' : '+ Ajouter un sous-livreur'}
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
            <input required value={form.telephone} onChange={(e) => setForm({ ...form, telephone: e.target.value })} placeholder="22 123 456" className="mt-1 w-full rounded-xl border border-black/10 px-3 py-2.5 text-sm" />
          </label>
          <label className="text-xs font-bold">
            Email (reçoit les commandes + sert de login)
            <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="karim@livraison.tn" className="mt-1 w-full rounded-xl border border-black/10 px-3 py-2.5 text-sm" />
          </label>
          <label className="text-xs font-bold">
            Mot de passe du compte sous-livreur {form.id ? '(laisser vide pour ne pas changer)' : '(min. 6 car.)'}
            <input type="password" minLength={6} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="••••••••" className="mt-1 w-full rounded-xl border border-black/10 px-3 py-2.5 text-sm" />
          </label>
          <label className="text-xs font-bold">
            Véhicule
            <input value={form.vehicule} onChange={(e) => setForm({ ...form, vehicule: e.target.value })} placeholder="Moto, Voiture, Scooter…" className="mt-1 w-full rounded-xl border border-black/10 px-3 py-2.5 text-sm" />
          </label>
          <label className="text-xs font-bold">
            Ville
            <input value={form.ville} onChange={(e) => setForm({ ...form, ville: e.target.value })} className="mt-1 w-full rounded-xl border border-black/10 px-3 py-2.5 text-sm" />
          </label>
          <label className="text-xs font-bold sm:col-span-2">
            Notes
            <input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Zone couverte, horaires…" className="mt-1 w-full rounded-xl border border-black/10 px-3 py-2.5 text-sm" />
          </label>
          <div className="flex items-center justify-end gap-2 sm:col-span-2">
            <button type="button" onClick={() => setOuvert(false)} className="h-10 rounded-xl border border-black/10 px-4 text-xs font-bold">
              Annuler
            </button>
            <button type="submit" disabled={envoi} className="h-10 rounded-xl bg-primary px-5 text-xs font-extrabold text-white">
              {envoi ? 'Enregistrement…' : form.id ? 'Mettre à jour' : 'Créer le sous-livreur'}
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
                <th className="py-2.5 pr-3">Téléphone / Email</th>
                <th className="py-2.5 pr-3">Ville & Véhicule</th>
                <th className="py-2.5 pr-3">Statut & Compte</th>
                <th className="py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {livreurs.map((l) => (
                <tr key={l.id} className="border-b border-black/5 hover:bg-[#f8f9fc]">
                  <td className="py-2.5 pr-3">
                    <div className="font-extrabold text-ink">{l.nom}</div>
                    {l.notes && <div className="text-[11px] italic text-muted">{l.notes}</div>}
                  </td>
                  <td className="py-2.5 pr-3">
                    <div className="font-bold">+{l.telephone}</div>
                    {l.email && <div className="text-[11px] text-muted">{l.email}</div>}
                  </td>
                  <td className="py-2.5 pr-3">{l.ville}{l.vehicule ? ` · ${l.vehicule}` : ''}</td>
                  <td className="py-2.5 pr-3">
                    <div className="flex flex-wrap gap-1">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold ${l.actif ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-700'}`}>{l.actif ? 'Actif' : 'Inactif'}</span>
                      {l.actif && <span className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold ${l.disponible ? 'bg-blue-100 text-blue-800' : 'bg-amber-100 text-amber-800'}`}>{l.disponible ? 'Dispo' : 'Occupé'}</span>}
                      {l.user_id && <span className="rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-extrabold text-purple-800">🔑 Compte</span>}
                    </div>
                  </td>
                  <td className="py-2.5 text-right">
                    <div className="inline-flex gap-1">
                      <button type="button" onClick={() => basculer(l, 'disponible')} className="rounded-lg border border-black/10 bg-white px-2 py-1 font-bold">{l.disponible ? 'Occupé' : 'Dispo'}</button>
                      <button type="button" onClick={() => basculer(l, 'actif')} className="rounded-lg border border-black/10 bg-white px-2 py-1 font-bold">{l.actif ? 'Désact.' : 'Activer'}</button>
                      <button
                        type="button"
                        onClick={() => {
                          setForm({ id: l.id, nom: l.nom, telephone: l.telephone.replace(/^216/, ''), email: l.email ?? '', password: '', ville: l.ville, vehicule: l.vehicule ?? '', notes: l.notes ?? '', actif: l.actif, disponible: l.disponible });
                          setOuvert(true);
                          setSucces('');
                        }}
                        className="rounded-lg bg-ink px-2.5 py-1 font-extrabold text-white"
                      >Modifier</button>
                      <button type="button" onClick={() => supprimer(l.id)} className="rounded-lg bg-red-50 px-2 py-1 font-bold text-red-700">Suppr.</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {livreurs.map((l) => (
            <div key={l.id} className="flex flex-col gap-3 rounded-3xl border border-black/5 bg-white p-4 shadow-sm">
              <div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-base font-extrabold text-ink">{l.nom}</span>
                  <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-extrabold ${l.actif ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-700'}`}>{l.actif ? 'Actif' : 'Désactivé'}</span>
                  {l.actif && <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-extrabold ${l.disponible ? 'bg-blue-100 text-blue-800' : 'bg-amber-100 text-amber-800'}`}>{l.disponible ? 'Disponible' : 'Occupé'}</span>}
                  {l.user_id && <span className="rounded-full bg-purple-100 px-2.5 py-0.5 text-[11px] font-extrabold text-purple-800">🔑 Compte</span>}
                </div>
                <p className="m-0 mt-1 text-xs text-muted">📞 +{l.telephone} {l.vehicule ? `· 🏍️ ${l.vehicule}` : ''} · 📍 {l.ville}</p>
                {l.email && <p className="m-0 text-xs text-muted">✉️ {l.email}</p>}
              </div>
              <div className="flex flex-wrap gap-1.5">
                <button type="button" onClick={() => basculer(l, 'disponible')} className="h-9 rounded-xl border border-black/10 px-3 text-xs font-bold">{l.disponible ? 'Mettre occupé' : 'Mettre dispo'}</button>
                <button type="button" onClick={() => basculer(l, 'actif')} className="h-9 rounded-xl border border-black/10 px-3 text-xs font-bold">{l.actif ? 'Désactiver' : 'Réactiver'}</button>
                <button
                  type="button"
                  onClick={() => {
                    setForm({ id: l.id, nom: l.nom, telephone: l.telephone.replace(/^216/, ''), email: l.email ?? '', password: '', ville: l.ville, vehicule: l.vehicule ?? '', notes: l.notes ?? '', actif: l.actif, disponible: l.disponible });
                    setOuvert(true);
                    setSucces('');
                  }}
                  className="h-9 rounded-xl bg-ink px-3 text-xs font-extrabold text-white"
                >Modifier</button>
                <button type="button" onClick={() => supprimer(l.id)} className="h-9 rounded-xl bg-red-50 px-3 text-xs font-extrabold text-red-700">Suppr.</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
