'use client';

import { useEffect, useState } from 'react';
import Link from '@/app/components/Lien';

type UserMini = {
  id: string;
  email: string;
  role: 'client' | 'livreur' | 'admin';
  nom: string;
};

export default function BoutonCompte() {
  const [user, setUser] = useState<UserMini | null>(null);

  useEffect(() => {
    let actif = true;
    fetch('/api/auth/me', { credentials: 'same-origin' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (actif && d?.user) setUser(d.user);
      })
      .catch(() => {});
    return () => {
      actif = false;
    };
  }, []);

  if (user?.role === 'admin' || user?.role === 'livreur') {
    return (
      <div className="flex items-center gap-1.5">
        <Link
          href="/admin"
          className="flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-ink px-3.5 text-xs font-extrabold text-white hover:opacity-90 sm:text-sm"
        >
          Admin
        </Link>
        <Link
          href="/compte"
          aria-label="Mon compte"
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-black/10 bg-white text-xs font-extrabold text-ink hover:bg-black/5"
        >
          {(user.nom || user.email).slice(0, 1).toUpperCase()}
        </Link>
      </div>
    );
  }

  if (user) {
    const prenom = (user.nom || user.email.split('@')[0]).split(' ')[0];
    return (
      <Link
        href="/compte"
        className="flex h-10 shrink-0 items-center gap-1.5 rounded-full border border-black/10 bg-white px-3 text-xs font-extrabold text-ink hover:bg-black/5 sm:text-sm"
      >
        <span className="grid h-6 w-6 place-items-center rounded-full bg-primary text-[11px] font-extrabold text-white">
          {prenom.slice(0, 1).toUpperCase()}
        </span>
        <span className="hidden sm:inline">{prenom}</span>
      </Link>
    );
  }

  return (
    <Link
      href="/compte"
      className="flex h-10 shrink-0 items-center gap-1.5 rounded-full border border-black/10 bg-white px-3 text-xs font-extrabold text-ink hover:bg-black/5 sm:px-3.5 sm:text-sm"
    >
      <span aria-hidden>👤</span>
      <span className="hidden xs:inline sm:inline">Compte</span>
    </Link>
  );
}
