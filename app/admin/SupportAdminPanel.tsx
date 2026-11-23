'use client';

import { useCallback, useEffect, useState } from 'react';
import type { AvisRestaurant, TicketMessage, TicketSupport } from '@/lib/app-features';

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

export default function SupportAdminPanel({ onCountChange }: { onCountChange?: (ouverts: number) => void }) {
  const [sousVue, setSousVue] = useState<'tickets' | 'avis'>('tickets');
  const [tickets, setTickets] = useState<TicketSupport[]>([]);
  const [avis, setAvis] = useState<AvisRestaurant[]>([]);
  const [actif, setActif] = useState<TicketSupport | null>(null);
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [reponse, setReponse] = useState('');
  const [busy, setBusy] = useState(false);

  const chargerTout = useCallback(async () => {
    const [rt, ra] = await Promise.all([
      fetch('/api/support', { credentials: 'same-origin' }).catch(() => null),
      fetch('/api/avis?tous=1', { credentials: 'same-origin' }).catch(() => null),
    ]);
    if (rt && rt.ok) {
      const d = await rt.json();
      setTickets(d.tickets ?? []);
      onCountChange?.(Number(d.ouverts ?? 0));
    }
    if (ra && ra.ok) {
      const d = await ra.json();
      setAvis(d.avis ?? []);
    }
  }, [onCountChange]);

  const ouvrirTicket = useCallback(async (id: string) => {
    const r = await fetch(`/api/support?ticket_id=${encodeURIComponent(id)}`, { credentials: 'same-origin' }).catch(() => null);
    if (r && r.ok) {
      const d = await r.json();
      setActif(d.ticket ?? null);
      setMessages(d.messages ?? []);
    }
  }, []);

  useEffect(() => {
    chargerTout();
  }, [chargerTout]);

  async function repondre(e: React.FormEvent) {
    e.preventDefault();
    if (!actif || !reponse.trim()) return;
    setBusy(true);
    try {
      const r = await fetch('/api/support', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ ticket_id: actif.id, message: reponse.trim() }),
      });
      const d = await r.json().catch(() => null);
      if (r.ok && d?.message) {
        setReponse('');
        setMessages((prev) => [...prev, d.message]);
        if (d.statut) setActif((prev) => (prev ? { ...prev, statut: d.statut } : prev));
        chargerTout();
      }
    } finally {
      setBusy(false);
    }
  }

  async function changerStatut(ticketId: string, statut: TicketSupport['statut']) {
    setBusy(true);
    try {
      const r = await fetch('/api/support', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ ticket_id: ticketId, statut }),
      });
      if (r.ok) {
        const d = await r.json();
        if (d?.ticket) setActif(d.ticket);
        await chargerTout();
      }
    } finally {
      setBusy(false);
    }
  }

  async function supprimerAvis(id: string) {
    const r = await fetch(`/api/avis?id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
      credentials: 'same-origin',
    });
    if (r.ok) setAvis((prev) => prev.filter((a) => a.id !== id));
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex gap-1.5 rounded-2xl bg-black/5 p-1">
          <button
            type="button"
            onClick={() => {
              setSousVue('tickets');
              setActif(null);
            }}
            className={`h-10 rounded-xl px-4 text-xs font-extrabold ${
              sousVue === 'tickets' ? 'bg-white text-ink shadow-sm' : 'text-muted'
            }`}
          >
            🎧 Tickets support ({tickets.length})
          </button>
          <button
            type="button"
            onClick={() => setSousVue('avis')}
            className={`h-10 rounded-xl px-4 text-xs font-extrabold ${
              sousVue === 'avis' ? 'bg-white text-ink shadow-sm' : 'text-muted'
            }`}
          >
            ⭐ Avis clients ({avis.length})
          </button>
        </div>
        <button type="button" onClick={chargerTout} className="h-9 rounded-xl border border-black/10 bg-white px-3 text-xs font-bold">
          ↻ Actualiser
        </button>
      </div>

      {sousVue === 'tickets' && (
        actif ? (
          <div className="flex flex-col gap-3 rounded-3xl border border-black/5 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <button type="button" onClick={() => setActif(null)} className="text-xs font-extrabold text-primary underline">
                  ← Retour aux tickets
                </button>
                <h3 className="m-0 mt-1 text-base font-extrabold text-ink">{actif.titre}</h3>
                <p className="m-0 text-xs text-muted">
                  👤 {actif.client_nom}
                  {actif.client_telephone ? ` · +${actif.client_telephone}` : ''}
                  {actif.commande_ref ? ` · N° ${actif.commande_ref}` : ''}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {actif.client_telephone && (
                  <a href={`tel:+${actif.client_telephone}`} className="inline-flex h-8 items-center rounded-xl border border-black/10 px-2.5 text-xs font-bold">
                    📞 Appeler
                  </a>
                )}
                {(['ouvert', 'en_cours', 'resolu'] as const).map((st) => (
                  <button
                    key={st}
                    type="button"
                    disabled={busy || actif.statut === st}
                    onClick={() => changerStatut(actif.id, st)}
                    className={`h-8 rounded-xl px-2.5 text-[11px] font-extrabold disabled:opacity-40 ${
                      actif.statut === st ? 'bg-ink text-white' : 'border border-black/10 bg-white text-ink'
                    }`}
                  >
                    {BADGE_TICKET[st].label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex max-h-80 flex-col gap-2 overflow-y-auto rounded-2xl bg-[#f6f7fb] p-3">
              {messages.map((m) => (
                <div key={m.id} className={`flex flex-col ${m.sender_role === 'admin' ? 'items-end' : 'items-start'}`}>
                  <span className="mb-0.5 text-[10px] font-bold text-muted">
                    {m.sender_nom} · {fmtDate(m.created_at)}
                  </span>
                  <div
                    className={`max-w-[85%] rounded-2xl px-3 py-2 text-xs font-semibold ${
                      m.sender_role === 'admin' ? 'bg-primary text-white' : 'bg-white text-ink shadow-sm'
                    }`}
                  >
                    {m.message}
                  </div>
                </div>
              ))}
            </div>

            <form onSubmit={repondre} className="flex gap-2">
              <input
                value={reponse}
                onChange={(e) => setReponse(e.target.value)}
                placeholder="Répondre au client (il reçoit aussi un email)…"
                maxLength={1000}
                className="h-11 flex-1 rounded-xl border border-black/10 px-3.5 text-xs outline-none focus:border-primary"
              />
              <button
                type="submit"
                disabled={busy || !reponse.trim()}
                className="h-11 rounded-xl bg-primary px-4 text-xs font-extrabold text-white disabled:opacity-40"
              >
                Répondre
              </button>
            </form>
          </div>
        ) : tickets.length === 0 ? (
          <div className="rounded-3xl bg-white p-8 text-center text-sm text-muted">Aucun ticket support client pour le moment.</div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {tickets.map((t) => {
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
                      👤 {t.client_nom}
                      {t.commande_ref ? ` · N° ${t.commande_ref}` : ''} · {fmtDate(t.updated_at)}
                    </p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-extrabold ${b.cls}`}>{b.label}</span>
                </button>
              );
            })}
          </div>
        )
      )}

      {sousVue === 'avis' && (
        avis.length === 0 ? (
          <div className="rounded-3xl bg-white p-8 text-center text-sm text-muted">Aucun avis client publié pour le moment.</div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {avis.map((a) => (
              <div key={a.id} className="flex items-start justify-between gap-3 rounded-3xl border border-black/5 bg-white p-4 shadow-sm">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-extrabold text-ink">{a.resto_nom}</span>
                    <span className="text-sm text-saffron">{'★'.repeat(a.note)}</span>
                  </div>
                  <p className="m-0 mt-0.5 text-xs text-muted">
                    Par <b>{a.client_nom}</b> · {fmtDate(a.created_at)}
                  </p>
                  {a.commentaire && <p className="m-0 mt-1 text-xs text-ink">{a.commentaire}</p>}
                </div>
                <button
                  type="button"
                  onClick={() => supprimerAvis(a.id)}
                  className="shrink-0 rounded-xl border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-extrabold text-red-700"
                >
                  Supprimer
                </button>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}
