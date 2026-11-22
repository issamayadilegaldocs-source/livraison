import { getMenu, getResto, getRestos, imageUrl } from '@/lib/catalogue';
import { prixClients } from '@/lib/config';
import { getLivreur } from '@/lib/livreur';
import type { PlatVue } from '@/app/resto/[slug]/Menu';

// Menu d'un resto en JSON statique, chargé par la page resto après affichage : la page HTML reste légère
// (le menu en prop client était écrit deux fois, dans le .html et dans le .txt RSC → 50 Mo à envoyer).
// Prix client (majoration comprise) calculés au build ; prix du resto et règles de majoration jamais exposés.
export const dynamic = 'force-static';
export const dynamicParams = false;

export function generateStaticParams() {
  return getRestos().map((r) => ({ slug: r.slug }));
}

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const resto = getResto((await params).slug)!;
  const menu = getMenu(resto.id)!;
  const plats: PlatVue[] = prixClients(menu.plats, getLivreur().majoration, resto.slug).map(({ prixResto: _r, ...p }) => ({
    ...p,
    groupes: p.groupes.map((g) => ({ ...g, options: g.options.map(({ prixResto: _o, ...o }) => o) })),
    thumb: imageUrl('product', p.image, 'thumb'),
    full: imageUrl('product', p.image, 'full'),
  }));
  return Response.json({ categories: menu.categories, plats });
}
