'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { MessageChat } from '@/lib/app-features';

const fmtHeure = (iso: string) => {
  try {
    return new Intl.DateTimeFormat('fr-FR', {
      timeZone: 'Africa/Tunis',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(iso));
  } catch {
    return '';
  }
};

export default function ChatCommandeBox({
  commandeId,
  titre,
  monRole = 'client',
  guestRef,
  guestTel,
  onClose,
}: {
  commandeId: string;
  titre?: string;
  monRole?: 'client' | 'livreur' | 'admin';
  guestRef?: string;
  guestTel?: string;
  onClose?: () => void;
}) {
  const [messages, setMessages] = useState<MessageChat[]>([]);
  const [texte, setTexte] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState('');
  const [chargement, setChargement] = useState(true);
  const finRef = useRef<HTMLDivElement>(null);

  const charger = useCallback(async () => {
    const qs = new URLSearchParams({ commande_id: commandeId });
    if (guestRef) qs.set('ref', guestRef);
    if (guestTel) qs.set('tel', guestTel);
    try {
      const r = await fetch(`/api/chat?${qs.toString()}`, { credentials: 'same-origin' });
      const d = await r.json().catch(() => null);
      if (r.ok && d) {
        setMessages(d.messages ?? []);
        setErreur('');
      } else if (d?.erreur) {
        setErreur(d.erreur);
      }
    } catch {
      /* ignore transient */
    } finally {
      setChargement(false);
    }
  }, [commandeId, guestRef, guestTel]);

  useEffect(() => {
    charger();
    const t = setInterval(() => {
      if (!document.hidden) charger();
    }, 5000);
    return () => clearInterval(t);
  }, [charger]);

  useEffect(() => {
    finRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [messages.length]);

  async function envoyer(msgText: string) {
    const clean = msgText.trim();
    if (!clean || envoi) return;
    setEnvoi(true);
    setErreur('');
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          commande_id: commandeId,
          message: clean,
          ...(guestRef ? { ref: guestRef } : {}),
          ...(guestTel ? { tel: guestTel } : {}),
        }),
      });
      const d = await res.json().catch(() => null);
      if (!res.ok) {
        setErreur(d?.erreur ?? 'Envoi impossible.');
        return;
      }
      setTexte('');
      if (d?.message) setMessages((prev) => [...prev, d.message]);
    } catch {
      setErreur('Erreur réseau.');
    } finally {
      setEnvoi(false);
    }
  }

  const rapides =
    monRole === 'client'
      ? ['Où en est ma commande ?', 'Je suis prêt à la porte', 'Merci !']
      : ['Je suis en route 🛵', 'J’arrive dans 5 min', 'Je suis devant l’adresse'];

  return (
    <div className="mt-3 flex flex-col overflow-hidden rounded-2xl border border-black/10 bg-[#f6f7fb]">
      <div className="flex items-center justify-between bg-ink px-3.5 py-2.5 text-white">
        <div className="min-w-0">
          <p className="m-0 truncate text-xs font-extrabold">💬 {titre || 'Chat en direct'}</p>
          <p className="m-0 text-[10px] text-white/75">Actualisé automatiquement toutes les 5s</p>
        </div>
        {onClose && (
          <button type="button" onClick={onClose} className="rounded-lg bg-white/15 px-2 py-1 text-xs font-bold text-white">
            ✕
          </button>
        )}
      </div>

      <div className="flex max-h-60 flex-col gap-2 overflow-y-auto p-3">
        {chargement ? (
          <p className="m-0 text-center text-xs text-muted">Chargement du chat…</p>
        ) : messages.length === 0 ? (
          <p className="m-0 py-3 text-center text-xs text-muted">
            Aucun message pour le moment. Envoyez un message rapide ci-dessous !
          </p>
        ) : (
          messages.map((m) => {
            const estMoi = (monRole === 'client' && m.sender_role === 'client') || (monRole !== 'client' && m.sender_role !== 'client');
            return (
              <div key={m.id} className={`flex flex-col ${estMoi ? 'items-end' : 'items-start'}`}>
                <span className="mb-0.5 text-[10px] font-bold text-muted">
                  {m.sender_nom} · {fmtHeure(m.created_at)}
                </span>
                <div
                  className={`max-w-[85%] rounded-2xl px-3 py-2 text-xs font-semibold leading-snug ${
                    estMoi ? 'rounded-br-sm bg-primary text-white' : 'rounded-bl-sm bg-white text-ink shadow-sm'
                  }`}
                >
                  {m.message}
                </div>
              </div>
            );
          })
        )}
        <div ref={finRef} />
      </div>

      {erreur && <p className="m-0 bg-red-50 px-3 py-1.5 text-[11px] font-bold text-red-700">{erreur}</p>}

      <div className="no-scrollbar flex gap-1.5 overflow-x-auto border-t border-black/5 bg-white px-2.5 pt-2">
        {rapides.map((r) => (
          <button
            key={r}
            type="button"
            disabled={envoi}
            onClick={() => envoyer(r)}
            className="shrink-0 rounded-full border border-black/10 bg-[#f6f7fb] px-2.5 py-1 text-[11px] font-bold text-ink hover:bg-black/5"
          >
            {r}
          </button>
        ))}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          envoyer(texte);
        }}
        className="flex items-center gap-1.5 bg-white p-2.5"
      >
        <input
          value={texte}
          onChange={(e) => setTexte(e.target.value)}
          maxLength={500}
          placeholder="Écrire un message…"
          className="h-10 flex-1 rounded-xl border border-black/10 bg-[#f6f7fb] px-3 text-xs outline-none focus:border-primary"
        />
        <button
          type="submit"
          disabled={envoi || !texte.trim()}
          className="h-10 rounded-xl bg-primary px-3.5 text-xs font-extrabold text-white disabled:opacity-40"
        >
          Envoyer
        </button>
      </form>
    </div>
  );
}
