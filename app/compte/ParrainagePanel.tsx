'use client';

import { useCallback, useEffect, useState } from 'react';
import type { InfoParrainage } from '@/lib/app-features';

const fmtPrix = (n: number) => `${Number(n).toFixed(3).replace('.', ',')} DT`;

export default function ParrainagePanel() {
  const [info, setInfo] = useState<InfoParrainage | null>(null);
  const [codeAmi, setCodeAmi] = useState('');
  const [copie, setCopie] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  const charger = useCallback(async () => {
    const r = await fetch('/api/parrainage', { credentials: 'same-origin' }).catch(() => null);
    if (r && r.ok) {
      const d = await r.json();
      setInfo(d.parrainage ?? null);
    }
  }, []);

  useEffect(() => {
    charger();
  }, [charger]);

  async function copierCode() {
    if (!info?.code) return;
    await navigator.clipboard?.writeText(info.code).catch(() => {});
    setCopie(true);
    setTimeout(() => setCopie(false), 2000);
  }

  async function appliquerCode(e: React.FormEvent) {
    e.preventDefault();
    if (!codeAmi.trim()) return;
    setEnvoi(true);
    setMsg('');
    setErr('');
    try {
      const r = await fetch('/api/parrainage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ code: codeAmi.trim().toUpperCase() }),
      });
      const d = await r.json().catch(() => null);
      if (!r.ok) {
        setErr(d?.erreur ?? 'Impossible d’appliquer ce code.');
        return;
      }
      setCodeAmi('');
      setMsg(d?.message ?? 'Code appliqué avec succès !');
      if (d?.parrainage) setInfo(d.parrainage);
    } catch {
      setErr('Erreur réseau.');
    } finally {
      setEnvoi(false);
    }
  }

  if (!info) {
    return <div className="mt-4 h-40 animate-pulse rounded-3xl bg-white" />;
  }

  const textePartage = `Rejoins-moi et gagne ${info.montantFilleul} DT de crédit livraison avec mon code parrainage ${info.code} sur ${typeof window !== 'undefined' ? window.location.origin : ''} !`;

  return (
    <div className="mt-4 flex flex-col gap-4">
      <div className="rounded-3xl bg-gradient-to-br from-primary to-ink p-5 text-white shadow-sm">
        <p className="m-0 text-xs font-extrabold uppercase tracking-wider text-white/80">🎁 Parrainage</p>
        <h2 className="m-0 mt-1 text-xl font-extrabold">
          Partagez votre code, gagnez {info.montantParrain} DT chacun !
        </h2>
        <p className="m-0 mt-1 text-xs text-white/85">
          Vos amis reçoivent {info.montantFilleul} DT dès qu’ils entrent votre code, et vous recevez {info.montantParrain} DT de crédit.
        </p>

        <div className="mt-4 flex items-center justify-between gap-2 rounded-2xl bg-white/15 px-4 py-3 backdrop-blur">
          <span className="font-mono text-xl font-extrabold tracking-widest">{info.code}</span>
          <button
            type="button"
            onClick={copierCode}
            className="h-9 rounded-xl bg-white px-3.5 text-xs font-extrabold text-ink"
          >
            {copie ? '✓ Copié' : '📋 Copier'}
          </button>
        </div>

        <a
          href={`https://wa.me/?text=${encodeURIComponent(textePartage)}`}
          target="_blank"
          rel="noreferrer"
          className="mt-3 flex h-11 w-full items-center justify-center rounded-2xl bg-[#25D366] text-sm font-extrabold text-white"
        >
          💬 Inviter un ami sur WhatsApp
        </a>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-3xl border border-black/5 bg-white p-4 shadow-sm">
          <p className="m-0 text-[11px] font-bold uppercase text-muted">Votre crédit</p>
          <p className="m-0 mt-1 text-2xl font-extrabold text-emerald-700">{fmtPrix(info.creditBalance)}</p>
        </div>
        <div className="rounded-3xl border border-black/5 bg-white p-4 shadow-sm">
          <p className="m-0 text-[11px] font-bold uppercase text-muted">Amis parrainés</p>
          <p className="m-0 mt-1 text-2xl font-extrabold text-ink">{info.invitedCount}</p>
        </div>
      </div>

      {msg && <p className="m-0 rounded-2xl bg-emerald-50 px-4 py-3 text-xs font-extrabold text-emerald-800">✓ {msg}</p>}
      {err && <p className="m-0 rounded-2xl bg-red-50 px-4 py-3 text-xs font-extrabold text-red-700">{err}</p>}

      {info.canApplyCode ? (
        <form onSubmit={appliquerCode} className="rounded-3xl border border-black/5 bg-white p-5 shadow-sm">
          <h3 className="m-0 text-sm font-extrabold text-ink">Vous avez le code d’un ami ?</h3>
          <p className="m-0 mt-0.5 text-xs text-muted">Entrez-le ci-dessous pour débloquer votre bonus de {info.montantFilleul} DT.</p>
          <div className="mt-3 flex gap-2">
            <input
              value={codeAmi}
              onChange={(e) => setCodeAmi(e.target.value.toUpperCase())}
              placeholder="EX : SAMI-4K9P"
              maxLength={24}
              className="h-11 flex-1 rounded-xl border border-black/10 px-3.5 font-mono text-sm font-extrabold uppercase outline-none focus:border-primary"
            />
            <button
              type="submit"
              disabled={envoi || !codeAmi.trim()}
              className="h-11 rounded-xl bg-ink px-4 text-xs font-extrabold text-white disabled:opacity-40"
            >
              {envoi ? '…' : 'Appliquer'}
            </button>
          </div>
        </form>
      ) : info.hasAppliedCode ? (
        <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-4 text-xs font-bold text-emerald-900">
          ✓ Vous avez déjà profité d’un code de parrainage. Partagez maintenant votre propre code pour cumuler plus de crédit !
        </div>
      ) : (
        <div className="rounded-3xl bg-white p-4 text-xs text-muted">Le programme de parrainage est temporairement en pause.</div>
      )}
    </div>
  );
}
