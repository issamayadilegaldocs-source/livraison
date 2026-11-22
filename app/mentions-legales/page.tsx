import type { Metadata } from 'next';
import Link from '@/app/components/Lien';
import { T } from '@/lib/i18n';

export const metadata: Metadata = { title: 'Mentions légales et propriété intellectuelle' };

// Texte à faire relire par un juriste. Ne pas affirmer de surveillance qui n'existe pas.
export default function MentionsLegales() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4 py-6 text-sm leading-relaxed">
      <h1 className="m-0 text-2xl font-extrabold"><T k="Mentions légales et propriété intellectuelle" /></h1>
      <p><T k="Ce site, son code, son design, ses données (restaurants, menus, prix) et ses images sont la propriété de Hamma. Tous droits réservés." /></p>
      <p><T k="Il est strictement interdit de copier, extraire, reproduire, republier, revendre ou héberger tout ou partie de ce site, de ses données ou de ses images, par quelque moyen que ce soit, y compris avec un script ou un outil automatique, sans autorisation écrite de Hamma." /></p>
      <p><T k="Toute copie ou utilisation non autorisée expose son auteur à des poursuites judiciaires, à une demande de retrait auprès de son hébergeur et à des dommages et intérêts." /></p>
      <p><T k="Les restaurants, leurs noms, leurs photos et leurs menus restent la propriété de leurs titulaires respectifs." /></p>
      <Link href="/" className="font-semibold text-muted hover:underline"><T k="← Accueil" /></Link>
    </div>
  );
}
