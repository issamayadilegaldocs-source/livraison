'use client';

import { useMemo, useState } from 'react';
import type { ClientCRM } from '@/lib/plateforme';

type Campagne = {
  id: string;
  canal: 'email' | 'whatsapp';
  sujet: string | null;
  message: string;
  nb_destinataires: number;
  nb_envoyes: number;
  created_at: string;
};

type LienWA = { id: string; nom: string; telephone: string; url: string; texte: string };

const fmtPrix = (n: number) => `${Number(n).toFixed(3).replace('.', ',')} DT`;
const fmtDate = (iso: string | null) => {
  if (!iso) return '—';
  try {
    return new Intl.DateTimeFormat('fr-FR', { timeZone: 'Africa/Tunis', day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(iso));
  } catch {
    return iso;
  }
};

export default function ClientsPanel({
  clients,
  campagnes,
  onReload,
}: {
  clients: ClientCRM[];
  campagnes: Campagne[];
  onReload: () => Promise<void>;
}) {
  const [q, setQ] = useState('');
  const [filtreEmail, setFiltreEmail] = useState(false);
  const [selection, setSelection] = useState<Record<string, boolean>>({});
  const [canal, setCanal] = useState<'email' | 'whatsapp'>('email');
  const [sujet, setSujet] = useState('Offre spéciale pour nos clients');
  const [message, setMessage] = useState('Bonjour {prenom}, merci pour votre fidélité ({commandes} commande(s)) ! Profitez de nos nouveautés aujourd’hui.');
  const [envoi, setEnvoi] = useState(false);
  const [retour, setRetour] = useState('');
  const [liensWA, setLiensWA] = useState<LienWA[]>([]);
  const [editionNote, setEditionNote] = useState<{ id: string; notes: string; tags: string } | null>(null);

  const filtres = useMemo(() => {
    const t = q.trim().toLowerCase();
    return clients.filter((c) => {
      if (filtreEmail && !c.email) return false;
      if (!t) return true;
      return (
        c.nom.toLowerCase().includes(t) ||
        c.telephone.includes(t) ||
        (c.email ?? '').toLowerCase().includes(t) ||
        (c.derniere_adresse ?? '').toLowerCase().includes(t) ||
        (c.tags ?? []).some((tag) => tag.toLowerCase().includes(t))
      );
    });
  }, [clients, q, filtreEmail]);

  const idsSelectionnes = useMemo(() => filtres.filter((c) => selection[c.id]).map((c) => c.id), [filtres, selection]);

  function toutSelectionner(val: boolean) {
    const next: Record<string, boolean> = { ...selection };
    for (const c of filtres) next[c.id] = val;
    setSelection(next);
  }

  function exporterCSV() {
    const header = ['Nom', 'Telephone', 'Email', 'Adresse', 'NbCommandes', 'TotalDepenseDT', 'DerniereCommande', 'OptInEmail', 'OptInWhatsApp', 'Tags', 'Notes'];
    const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const rows = filtres.map((c) => [
      c.nom,
      c.telephone,
      c.email ?? '',
      c.derniere_adresse ?? '',
      c.nb_commandes,
      Number(c.total_depense).toFixed(3),
      c.derniere_commande_at ?? '',
      c.marketing_email ? 'oui' : 'non',
      c.marketing_whatsapp ? 'oui' : 'non',
      (c.tags ?? []).join(';'),
      c.notes_admin ?? '',
    ]);
    const csv = '\uFEFF' + [header.map(esc).join(','), ...rows.map((r) => r.map(esc).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `clients-crm-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function envoyerCampagne(e: React.FormEvent) {
    e.preventDefault();
    if (!idsSelectionnes.length) {
      setRetour('Sélectionnez au moins un client dans la liste.');
      return;
    }
    setEnvoi(true);
    setRetour('');
    setLiensWA([]);
    try {
      const res = await fetch('/api/admin/notifier', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ canal, client_ids: idsSelectionnes, sujet, message }),
      });
      const d = await res.json();
      if (!res.ok) return setRetour(d.erreur ?? 'Erreur lors de la notification.');
      if (canal === 'email') {
        setRetour(`Campagne email terminée : ${d.nb_envoyes} envoyé(s) sur ${d.nb_destinataires} client(s) avec email actif.`);
      } else {
        setLiensWA(d.liens ?? []);
        setRetour(`${d.nb_destinataires} lien(s) WhatsApp personnalisés prêts ci-dessous.`);
      }
      await onReload();
    } catch {
      setRetour('Erreur réseau.');
    } finally {
      setEnvoi(false);
    }
  }

  async function sauvegarderNotes(e: React.FormEvent) {
    e.preventDefault();
    if (!editionNote) return;
    const tags = editionNote.tags
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const res = await fetch('/api/admin/clients', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ id: editionNote.id, notes_admin: editionNote.notes || null, tags }),
    });
    if (res.ok) {
      setEditionNote(null);
      await onReload();
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Panneau campagnes Email / WhatsApp */}
      <form onSubmit={envoyerCampagne} className="rounded-3xl border border-black/5 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="m-0 text-base font-extrabold text-ink">📣 Notifier les clients ({idsSelectionnes.length} sélectionné{idsSelectionnes.length > 1 ? 's' : ''})</h2>
            <p className="m-0 mt-0.5 text-xs text-muted">
              Variables disponibles : <code>{'{nom}'}</code>, <code>{'{prenom}'}</code>, <code>{'{commandes}'}</code>
            </p>
          </div>
          <div className="flex gap-1.5 rounded-xl bg-black/5 p-1">
            <button
              type="button"
              onClick={() => setCanal('email')}
              className={`h-9 rounded-lg px-3 text-xs font-extrabold ${canal === 'email' ? 'bg-white text-ink shadow-sm' : 'text-muted'}`}
            >
              📧 Email
            </button>
            <button
              type="button"
              onClick={() => setCanal('whatsapp')}
              className={`h-9 rounded-lg px-3 text-xs font-extrabold ${canal === 'whatsapp' ? 'bg-[#25D366] text-white shadow-sm' : 'text-muted'}`}
            >
              💬 WhatsApp
            </button>
          </div>
        </div>

        <div className="mt-3 flex flex-col gap-2.5">
          {canal === 'email' && (
            <input
              type="text"
              value={sujet}
              onChange={(e) => setSujet(e.target.value)}
              placeholder="Sujet de l'email"
              className="w-full rounded-xl border border-black/10 px-3.5 py-2.5 text-sm outline-none focus:border-primary"
            />
          )}
          <textarea
            rows={3}
            required
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Message à envoyer…"
            className="w-full rounded-xl border border-black/10 px-3.5 py-2.5 text-sm outline-none focus:border-primary"
          />
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="submit"
              disabled={envoi || !idsSelectionnes.length}
              className={`h-11 rounded-xl px-5 text-sm font-extrabold text-white disabled:opacity-40 ${canal === 'whatsapp' ? 'bg-[#25D366]' : 'bg-primary'}`}
            >
              {envoi ? 'Traitement…' : canal === 'email' ? `Envoyer email (${idsSelectionnes.length})` : `Préparer WhatsApp (${idsSelectionnes.length})`}
            </button>
            <button
              type="button"
              onClick={exporterCSV}
              className="h-11 rounded-xl border border-black/10 bg-white px-4 text-xs font-extrabold text-ink hover:bg-black/5"
            >
              ⬇ Exporter CSV ({filtres.length})
            </button>
          </div>
        </div>

        {retour && <p className="mt-3 rounded-xl bg-blue-50 px-3.5 py-2.5 text-xs font-bold text-blue-900">{retour}</p>}

        {liensWA.length > 0 && (
          <div className="mt-3 flex flex-col gap-2 rounded-2xl bg-[#e6f6ec] p-3">
            <p className="m-0 text-xs font-extrabold text-[#14753d]">Cliquez sur chaque client pour envoyer son message WhatsApp pré-rempli :</p>
            <div className="flex flex-wrap gap-2">
              {liensWA.map((l) => (
                <a
                  key={l.id}
                  href={l.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-[#25D366] px-3.5 text-xs font-extrabold text-white hover:opacity-90"
                >
                  💬 {l.nom} ({l.telephone.slice(3)})
                </a>
              ))}
            </div>
          </div>
        )}
      </form>

      {/* Filtres & liste CRM */}
      <div className="rounded-3xl border border-black/5 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Rechercher nom, téléphone, email, tag…"
            className="h-11 min-w-[200px] flex-1 rounded-xl border border-black/10 px-3.5 text-sm outline-none focus:border-primary"
          />
          <button
            type="button"
            onClick={() => setFiltreEmail((v) => !v)}
            className={`h-11 rounded-xl border px-3 text-xs font-extrabold ${filtreEmail ? 'border-primary bg-primary text-white' : 'border-black/10 bg-white text-ink'}`}
          >
            Avec email
          </button>
          <button
            type="button"
            onClick={() => toutSelectionner(idsSelectionnes.length < filtres.length)}
            className="h-11 rounded-xl border border-black/10 bg-white px-3 text-xs font-extrabold text-ink hover:bg-black/5"
          >
            {idsSelectionnes.length === filtres.length && filtres.length > 0 ? 'Tout désélectionner' : `Tout cocher (${filtres.length})`}
          </button>
        </div>

        <div className="mt-4 flex flex-col gap-2.5">
          {filtres.length === 0 && <p className="py-8 text-center text-sm text-muted">Aucun client enregistré pour le moment.</p>}
          {filtres.map((c) => (
            <div key={c.id} className="flex flex-col gap-2 rounded-2xl border border-black/5 bg-[#f8f9fc] p-3.5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={Boolean(selection[c.id])}
                  onChange={(e) => setSelection((s) => ({ ...s, [c.id]: e.target.checked }))}
                  className="mt-1 h-5 w-5 accent-primary"
                />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-extrabold text-ink">{c.nom}</span>
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-extrabold text-primary">
                      {c.nb_commandes} cmd · {fmtPrix(c.total_depense)}
                    </span>
                    {c.user_id && <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-extrabold text-emerald-800">Compte</span>}
                  </div>
                  <p className="m-0 mt-0.5 text-xs text-muted">
                    📞 +{c.telephone} {c.email ? `· ✉️ ${c.email}` : '· Sans email'}
                  </p>
                  {c.derniere_adresse && <p className="m-0 text-xs text-muted">📍 {c.derniere_adresse}</p>}
                  <p className="m-0 text-[11px] text-muted">Dernière commande : {fmtDate(c.derniere_commande_at)}</p>
                  {(c.tags?.length > 0 || c.notes_admin) && (
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      {(c.tags ?? []).map((t) => (
                        <span key={t} className="rounded-md bg-black/10 px-2 py-0.5 text-[10px] font-bold text-ink">
                          #{t}
                        </span>
                      ))}
                      {c.notes_admin && <span className="text-xs italic text-muted">« {c.notes_admin} »</span>}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex shrink-0 flex-wrap gap-1.5 ps-8 sm:ps-0">
                <a href={`tel:+${c.telephone}`} className="flex h-9 items-center rounded-xl border border-black/10 bg-white px-3 text-xs font-bold text-ink">
                  📞 Appeler
                </a>
                <a
                  href={`https://wa.me/${c.telephone}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex h-9 items-center rounded-xl bg-[#25D366] px-3 text-xs font-extrabold text-white"
                >
                  WhatsApp
                </a>
                <button
                  type="button"
                  onClick={() => setEditionNote({ id: c.id, notes: c.notes_admin ?? '', tags: (c.tags ?? []).join(', ') })}
                  className="h-9 rounded-xl border border-black/10 bg-white px-3 text-xs font-bold text-ink"
                >
                  Note/Tags
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Modal édition notes/tags */}
      {editionNote && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
          <form onSubmit={sauvegarderNotes} className="w-full max-w-md rounded-3xl bg-white p-5 shadow-xl">
            <h3 className="m-0 text-base font-extrabold">Notes & tags client</h3>
            <label className="mt-3 block text-xs font-bold">
              Tags (séparés par virgule)
              <input
                type="text"
                value={editionNote.tags}
                onChange={(e) => setEditionNote({ ...editionNote, tags: e.target.value })}
                placeholder="vip, sfax, fidelite"
                className="mt-1 w-full rounded-xl border border-black/10 px-3 py-2.5 text-sm"
              />
            </label>
            <label className="mt-3 block text-xs font-bold">
              Note interne admin
              <textarea
                rows={3}
                value={editionNote.notes}
                onChange={(e) => setEditionNote({ ...editionNote, notes: e.target.value })}
                className="mt-1 w-full rounded-xl border border-black/10 px-3 py-2.5 text-sm"
              />
            </label>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setEditionNote(null)} className="h-10 rounded-xl border border-black/10 px-4 text-xs font-bold">
                Annuler
              </button>
              <button type="submit" className="h-10 rounded-xl bg-primary px-4 text-xs font-extrabold text-white">
                Enregistrer
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Historique des campagnes */}
      {campagnes.length > 0 && (
        <div className="rounded-3xl border border-black/5 bg-white p-4 shadow-sm sm:p-5">
          <h3 className="m-0 text-sm font-extrabold text-ink">Historique des notifications envoyées</h3>
          <div className="mt-3 flex flex-col gap-2">
            {campagnes.map((cp) => (
              <div key={cp.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[#f8f9fc] px-3 py-2 text-xs">
                <div>
                  <span className="font-extrabold uppercase text-primary">{cp.canal}</span> · <b>{cp.sujet || 'Sans sujet'}</b>
                  <p className="m-0 line-clamp-1 text-muted">{cp.message}</p>
                </div>
                <span className="font-bold text-ink">
                  {cp.nb_envoyes}/{cp.nb_destinataires} · {fmtDate(cp.created_at)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
