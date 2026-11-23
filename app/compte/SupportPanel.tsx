'use client';

import { useCallback, useEffect, useState } from 'react';
import type { TicketMessage, TicketSupport } from '@/lib/app-features';

const BADGE_TICKET: Record<TicketSupport['statut'], { label: string; cls: string }> = {
  ouvert: { label: 'Ouvert', cls: 'bg-blue-100 text-blue-800' },
  en_cours: { label: 'En cours', cls: 'bg-amber-100 text-amber-800' },
  resolu: { label: 'Résolu', cls: 'bg-emerald-100 text-emerald-800' },
};

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
    return '';
  }
};

export default function SupportPanel() {
  const [tickets, setTickets] = useState<TicketSupport[]>([]);
  const [actif, setActif] = useState<TicketSupport | null>(null);
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [categorie, setCategorie] = useState<'order related' | 'others'>('order related');
  const [commandeRef, setCommandeRef] = useState('');
  const [titre, setTitre] = useState('');
  const [description, setDescription] = useState('');
  const [reponse, setReponse] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  const chargerTickets = useCallback(async () => {
    const r = await fetch('/api/support', { credentials: 'same-origin' }).catch(() => null);
    if (r && r.ok) {
      const d = await r.json();
      setTickets(d.tickets ?? []);
    }
  }, []);

  const ouvrirTicket = useCallback(async (id: string) => {
    const r = await fetch(`/api/support?ticket_id=${encodeURIComponent(id)}`, { credentials: 'same-origin' }).catch(() => null);
    if (r && r.ok) {
      const d = await r.json();
      setActif(d.ticket ?? null);
      setMessages(d.messages ?? []);
    }
  }, []);

  useEffect(() => {
    chargerTickets();
  }, [chargerTickets]);

  async function creerTicket(e: React.FormEvent) {
    e.preventDefault();
    setEnvoi(true);
    setMsg('');
    setErr('');
    try {
      const r = await fetch('/api/support', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          categorie,
          titre: titre.trim(),
          message: description.trim(),
          commande_ref: commandeRef.trim() || undefined,
        }),
      });
      const d = await r.json().catch(() => null);
      if (!r.ok) {
        setErr(d?.erreur ?? 'Impossible de créer le ticket.');
        return;
      }
      setTitre('');
      setDescription('');
      setCommandeRef('');
      setMsg('Votre demande a bien été envoyée. Notre équipe vous répond ici très vite.');
      await chargerTickets();
      if (d?.ticket?.id) await ouvrirTicket(d.ticket.id);
    } catch {
      setErr('Erreur réseau.');
    } finally {
      setEnvoi(false);
    }
  }

  async function repondre(e: React.FormEvent) {
    e.preventDefault();
    if (!actif || !reponse.trim()) return;
    setEnvoi(true);
    setErr('');
    try {
      const r = await fetch('/api/support', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ ticket_id: actif.id, message: reponse.trim() }),
      });
      const d = await r.json().catch(() => null);
      if (!r.ok) {
        setErr(d?.erreur ?? 'Envoi impossible.');
        return;
      }
      setReponse('');
      if (d?.message) setMessages((prev) => [...prev, d.message]);
    } catch {
      setErr('Erreur réseau.');
    } finally {
      setEnvoi(false);
    }
  }

  if (actif) {
    const b = BADGE_TICKET[actif.statut] ?? BADGE_TICKET.ouvert;
    return (
      <div className="mt-4 flex flex-col gap-3 rounded-3xl border border-black/5 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex items-start justify-between gap-2">
          <div>
            <button type="button" onClick={() => setActif(null)} className="text-xs font-extrabold text-primary underline">
              ← Tous mes tickets
            </button>
            <h3 className="m-0 mt-1 text-base font-extrabold text-ink">{actif.titre}</h3>
            <p className="m-0 text-xs text-muted">
              {actif.categorie === 'order related' ? '📦 Commande' : '💬 Autre'}
              {actif.commande_ref ? ` · N° ${actif.commande_ref}` : ''} · {fmtDate(actif.created_at)}
            </p>
          </div>
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-extrabold ${b.cls}`}>{b.label}</span>
        </div>

        <div className="flex max-h-72 flex-col gap-2 overflow-y-auto rounded-2xl bg-[#f6f7fb] p-3">
          {messages.map((m) => (
            <div key={m.id} className={`flex flex-col ${m.sender_role === 'client' ? 'items-end' : 'items-start'}`}>
              <span className="mb-0.5 text-[10px] font-bold text-muted">
                {m.sender_nom} · {fmtDate(m.created_at)}
              </span>
              <div
                className={`max-w-[85%] rounded-2xl px-3 py-2 text-xs font-semibold ${
                  m.sender_role === 'client' ? 'bg-primary text-white' : 'bg-white text-ink shadow-sm'
                }`}
              >
                {m.message}
              </div>
            </div>
          ))}
        </div>

        {err && <p className="m-0 text-xs font-bold text-red-700">{err}</p>}

        {actif.statut !== 'resolu' ? (
          <form onSubmit={repondre} className="flex gap-2">
            <input
              value={reponse}
              onChange={(e) => setReponse(e.target.value)}
              placeholder="Ajouter un message…"
              maxLength={1000}
              className="h-10 flex-1 rounded-xl border border-black/10 px-3 text-xs outline-none focus:border-primary"
            />
            <button type="submit" disabled={envoi || !reponse.trim()} className="h-10 rounded-xl bg-ink px-4 text-xs font-extrabold text-white disabled:opacity-40">
              Envoyer
            </button>
          </form>
        ) : (
          <p className="m-0 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800">
            ✓ Ce ticket est résolu. Ouvrez un nouveau ticket si besoin.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="mt-4 flex flex-col gap-4">
      {msg && <p className="m-0 rounded-2xl bg-emerald-50 px-4 py-3 text-xs font-extrabold text-emerald-800">✓ {msg}</p>}
      {err && <p className="m-0 rounded-2xl bg-red-50 px-4 py-3 text-xs font-extrabold text-red-700">{err}</p>}

      <form onSubmit={creerTicket} className="flex flex-col gap-3 rounded-3xl border border-black/5 bg-white p-5 shadow-sm">
        <h2 className="m-0 text-base font-extrabold">🎧 Contacter le support</h2>
        <div className="grid grid-cols-2 gap-1.5">
          {([
            ['order related', '📦 Lié à une commande'],
            ['others', '💬 Autre question'],
          ] as const).map(([cle, lbl]) => (
            <button
              key={cle}
              type="button"
              onClick={() => setCategorie(cle)}
              className={`h-10 rounded-xl border text-xs font-extrabold ${
                categorie === cle ? 'border-primary bg-primary/10 text-primary' : 'border-black/10 bg-white text-ink'
              }`}
            >
              {lbl}
            </button>
          ))}
        </div>
        {categorie === 'order related' && (
          <input
            value={commandeRef}
            onChange={(e) => setCommandeRef(e.target.value.toUpperCase())}
            placeholder="N° de commande (ex. TEST01, optionnel)"
            className="h-11 rounded-xl border border-black/10 px-3.5 text-sm uppercase outline-none focus:border-primary"
          />
        )}
        <input
          required
          minLength={3}
          maxLength={120}
          value={titre}
          onChange={(e) => setTitre(e.target.value)}
          placeholder="Sujet (ex. Retard, article manquant, question…)"
          className="h-11 rounded-xl border border-black/10 px-3.5 text-sm outline-none focus:border-primary"
        />
        <textarea
          required
          minLength={3}
          maxLength={1000}
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Expliquez-nous comment vous aider…"
          className="rounded-xl border border-black/10 px-3.5 py-2.5 text-sm outline-none focus:border-primary"
        />
        <button type="submit" disabled={envoi} className="h-11 rounded-2xl bg-primary text-sm font-extrabold text-white disabled:opacity-50">
          {envoi ? 'Envoi…' : 'Ouvrir un ticket d’aide'}
        </button>
      </form>

      <div className="flex flex-col gap-2.5">
        <h3 className="m-0 text-sm font-extrabold text-ink">Mes demandes ({tickets.length})</h3>
        {tickets.length === 0 ? (
          <div className="rounded-3xl bg-white p-6 text-center text-xs text-muted">Aucune demande d’aide ouverte.</div>
        ) : (
          tickets.map((t) => {
            const b = BADGE_TICKET[t.statut] ?? BADGE_TICKET.ouvert;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => ouvrirTicket(t.id)}
                className="flex items-center justify-between gap-3 rounded-3xl border border-black/5 bg-white p-4 text-left shadow-sm hover:border-primary/40"
              >
                <div className="min-w-0">
                  <p className="m-0 truncate text-sm font-extrabold text-ink">{t.titre}</p>
                  <p className="m-0 mt-0.5 text-xs text-muted">
                    {t.commande_ref ? `N° ${t.commande_ref} · ` : ''}
                    {fmtDate(t.updated_at)}
                  </p>
                </div>
                <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-extrabold ${b.cls}`}>{b.label}</span>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
