'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from '@/app/components/Lien';
import type { AvisRestaurant } from '@/lib/app-features';

const fmtDate = (iso: string) => {
  try {
    return new Intl.DateTimeFormat('fr-FR', {
      timeZone: 'Africa/Tunis',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(new Date(iso));
  } catch {
    return '';
  }
};

export default function AvisRestoSection({ slug, nom }: { slug: string; nom: string }) {
  const [avis, setAvis] = useState<AvisRestaurant[]>([]);
  const [moyenne, setMoyenne] = useState(0);
  const [total, setTotal] = useState(0);
  const [repartition, setRepartition] = useState<Record<number, number>>({ 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 });
  const [ouvert, setOuvert] = useState(false);
  const [note, setNote] = useState(5);
  const [commentaire, setCommentaire] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  const charger = useCallback(async () => {
    const r = await fetch(`/api/avis?resto=${encodeURIComponent(slug)}`).catch(() => null);
    if (!r || !r.ok) return;
    const d = await r.json().catch(() => null);
    if (!d) return;
    setAvis(d.avis ?? []);
    setMoyenne(Number(d.moyenne ?? 0));
    setTotal(Number(d.total ?? 0));
    if (d.repartition) setRepartition(d.repartition);
  }, [slug]);

  useEffect(() => {
    charger();
  }, [charger]);

  async function publier(e: React.FormEvent) {
    e.preventDefault();
    setEnvoi(true);
    setMsg('');
    setErr('');
    try {
      const r = await fetch('/api/avis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ resto_slug: slug, resto_nom: nom, note, commentaire }),
      });
      const d = await r.json().catch(() => null);
      if (!r.ok) {
        setErr(d?.erreur ?? 'Impossible de publier votre avis.');
        return;
      }
      setCommentaire('');
      setOuvert(false);
      setMsg('Merci ! Votre avis a bien été publié.');
      await charger();
    } catch {
      setErr('Erreur réseau.');
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <section className="mt-6 rounded-[28px] border border-black/5 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="m-0 text-lg font-extrabold text-ink">⭐ Avis clients ({total})</h2>
          <p className="m-0 mt-0.5 text-xs text-muted">
            {total > 0 ? `Note moyenne : ${moyenne.toFixed(1)} / 5` : 'Soyez le premier à noter ce restaurant !'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setOuvert((v) => !v);
            setMsg('');
            setErr('');
          }}
          className="h-10 rounded-2xl bg-ink px-4 text-xs font-extrabold text-white"
        >
          {ouvert ? 'Fermer' : '✍️ Laisser un avis'}
        </button>
      </div>

      {total > 0 && (
        <div className="mt-4 grid grid-cols-1 gap-4 rounded-2xl bg-[#f6f7fb] p-4 sm:grid-cols-3 sm:items-center">
          <div className="text-center">
            <p className="m-0 text-4xl font-extrabold text-ink">{moyenne.toFixed(1)}</p>
            <p className="m-0 text-base text-saffron">{'★'.repeat(Math.round(moyenne))}{'☆'.repeat(5 - Math.round(moyenne))}</p>
            <p className="m-0 mt-0.5 text-xs text-muted">{total} avis vérifié(s)</p>
          </div>
          <div className="flex flex-col gap-1 sm:col-span-2">
            {[5, 4, 3, 2, 1].map((n) => {
              const c = repartition[n] ?? 0;
              const pct = total ? Math.round((c / total) * 100) : 0;
              return (
                <div key={n} className="flex items-center gap-2 text-xs font-bold">
                  <span className="w-7 text-right">{n}★</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-black/10">
                    <div className="h-full rounded-full bg-saffron" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="w-7 text-muted">{c}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {msg && <p className="mt-3 rounded-2xl bg-emerald-50 px-4 py-2.5 text-xs font-extrabold text-emerald-800">✓ {msg}</p>}
      {err && (
        <p className="mt-3 rounded-2xl bg-red-50 px-4 py-2.5 text-xs font-extrabold text-red-700">
          {err}{' '}
          {err.includes('Connectez-vous') && (
            <Link href="/compte" className="underline">
              Se connecter →
            </Link>
          )}
        </p>
      )}

      {ouvert && (
        <form onSubmit={publier} className="mt-4 flex flex-col gap-3 rounded-2xl border border-black/10 bg-[#f6f7fb] p-4">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-extrabold text-ink">Votre note :</span>
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setNote(n)}
                className={`text-2xl transition active:scale-90 ${n <= note ? 'text-saffron' : 'text-black/20'}`}
                aria-label={`${n} étoiles`}
              >
                ★
              </button>
            ))}
          </div>
          <textarea
            value={commentaire}
            onChange={(e) => setCommentaire(e.target.value)}
            maxLength={500}
            rows={2}
            placeholder="Qualité des plats, rapidité, accueil… (optionnel)"
            className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm outline-none focus:border-primary"
          />
          <button
            type="submit"
            disabled={envoi}
            className="h-10 self-start rounded-xl bg-primary px-5 text-xs font-extrabold text-white disabled:opacity-50"
          >
            {envoi ? 'Envoi…' : 'Publier mon avis'}
          </button>
        </form>
      )}

      {avis.length > 0 && (
        <div className="mt-4 flex flex-col gap-2.5">
          {avis.slice(0, 10).map((a) => (
            <article key={a.id} className="rounded-2xl border border-black/5 bg-[#f9fafc] p-3.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-extrabold text-ink">{a.client_nom}</span>
                <span className="text-[11px] text-muted">{fmtDate(a.created_at)}</span>
              </div>
              <div className="mt-0.5 text-sm text-saffron">
                {'★'.repeat(a.note)}
                <span className="text-black/15">{'★'.repeat(5 - a.note)}</span>
              </div>
              {a.commentaire && <p className="m-0 mt-1 text-xs leading-relaxed text-ink/90">{a.commentaire}</p>}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
