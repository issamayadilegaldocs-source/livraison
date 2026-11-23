'use client';

import { useReglages } from '@/lib/reglages';

const IconeInstagram = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="2.5" y="2.5" width="19" height="19" rx="5" />
    <circle cx="12" cy="12" r="4" />
    <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
  </svg>
);

const IconeFacebook = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M13.5 22v-8h2.7l.4-3h-3.1V9.1c0-.9.3-1.5 1.6-1.5h1.6V4.9c-.3 0-1.3-.1-2.4-.1-2.4 0-4 1.5-4 4.1V11H7.6v3h2.7v8h3.2z" />
  </svg>
);

const IconeTikTok = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1 0-5.78c.27 0 .54.04.79.1V8.9a6.33 6.33 0 0 0-.79-.05A6.34 6.34 0 0 0 3.15 15.2a6.34 6.34 0 0 0 10.86 4.43 6.26 6.26 0 0 0 1.81-4.43V8.73a8.28 8.28 0 0 0 4.83 1.55V6.83c-.36 0-.71-.05-1.06-.14z" />
  </svg>
);

/**
 * Boutons fluides « Suivez-nous » Instagram / Facebook / TikTok pilotés depuis /admin → Réglages.
 * variante='compact' : icônes rapides dans l'en-tête.
 * variante='carte' : belle carte d'abonnement dans le pied de page ou le Profil client.
 */
export default function ReseauxSociaux({ variante = 'carte' }: { variante?: 'compact' | 'carte' }) {
  const r = useReglages();
  const fb = r?.reseaux?.facebook?.trim();
  const ig = r?.reseaux?.instagram?.trim();
  const tk = r?.reseaux?.tiktok?.trim();

  if (!fb && !ig && !tk) return null;

  if (variante === 'compact') {
    return (
      <div className="hidden items-center gap-1.5 md:flex">
        {ig && (
          <a
            href={ig}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Suivre sur Instagram"
            title="Suivre sur Instagram"
            className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-tr from-[#f58529] via-[#dd2a7b] to-[#8134af] text-white shadow-sm transition hover:scale-105"
          >
            <IconeInstagram />
          </a>
        )}
        {fb && (
          <a
            href={fb}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Suivre sur Facebook"
            title="Suivre sur Facebook"
            className="grid h-9 w-9 place-items-center rounded-full bg-[#1877F2] text-white shadow-sm transition hover:scale-105"
          >
            <IconeFacebook />
          </a>
        )}
        {tk && (
          <a
            href={tk}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Suivre sur TikTok"
            title="Suivre sur TikTok"
            className="grid h-9 w-9 place-items-center rounded-full bg-ink text-white shadow-sm transition hover:scale-105"
          >
            <IconeTikTok />
          </a>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-2.5 rounded-3xl border border-black/5 bg-[#f8f9fc] px-4 py-4">
      <p className="m-0 text-xs font-extrabold uppercase tracking-wide text-ink">Suivez-nous pour les promos &amp; nouveautés</p>
      <div className="flex flex-wrap items-center justify-center gap-2">
        {ig && (
          <a
            href={ig}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-10 items-center gap-2 rounded-full bg-gradient-to-tr from-[#f58529] via-[#dd2a7b] to-[#8134af] px-4 text-xs font-extrabold text-white shadow-sm transition hover:opacity-95"
          >
            <IconeInstagram />
            <span>Suivre sur Instagram</span>
          </a>
        )}
        {fb && (
          <a
            href={fb}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-10 items-center gap-2 rounded-full bg-[#1877F2] px-4 text-xs font-extrabold text-white shadow-sm transition hover:opacity-95"
          >
            <IconeFacebook />
            <span>Suivre sur Facebook</span>
          </a>
        )}
        {tk && (
          <a
            href={tk}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-10 items-center gap-2 rounded-full bg-ink px-4 text-xs font-extrabold text-white shadow-sm transition hover:opacity-95"
          >
            <IconeTikTok />
            <span>Suivre sur TikTok</span>
          </a>
        )}
      </div>
    </div>
  );
}
