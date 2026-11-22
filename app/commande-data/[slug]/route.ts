import { getMenu, getResto, getRestos } from '@/lib/catalogue';
import { mediaBase } from '@/lib/media';

// Resto + menu d'un seul restaurant, lus par la Function de commande via env.ASSETS : elle ne parse
// qu'un petit fichier (limite CPU 10 ms du plan gratuit), jamais restos.json en entier.
export const dynamic = 'force-static';
export const dynamicParams = false;

export function generateStaticParams() {
  return getRestos().map((r) => ({ slug: r.slug }));
}

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const resto = getResto((await params).slug)!;
  const { plats: _plats, ...sansPlats } = resto;
  return Response.json({ resto: { ...sansPlats, plats: [] }, menu: getMenu(resto.id), media: mediaBase() });
}
