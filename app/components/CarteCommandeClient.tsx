'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import Link from '@/app/components/Lien';
import ChatCommandeBox from '@/app/components/ChatCommandeBox';

const CarteTracking = dynamic(() => import('@/app/admin/CarteTracking'), { ssr: false });

export type StatutClient = 'nouvelle' | 'confirmee' | 'en_preparation' | 'en_livraison' | 'livree' | 'annulee';

export type CommandeClient = {
  id: string;
  ref: string;
  type: 'repas' | 'colis';
  statut: StatutClient;
  creee: string;
  fin: string | null;
  statut_updated_at: string | null;
  historique_statuts: { statut: StatutClient; at: string }[];
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

const ETAPES: { cle: StatutClient; label: string }[] = [
  { cle: 'nouvelle', label: 'Reçue' },
  { cle: 'confirmee', label: 'Confirmée' },
  { cle: 'en_preparation', label: 'Préparation' },
  { cle: 'en_livraison', label: 'En route' },
  { cle: 'livree', label: 'Livrée' },
];

const BADGE: Record<StatutClient, { texte: string; cls: string }> = {
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

export default function CarteCommandeClient({
  c,
  guestRef,
  guestTel,
}: {
  c: CommandeClient;
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
