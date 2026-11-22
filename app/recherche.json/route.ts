import { getRestos } from '@/lib/catalogue';

// Index des plats pour la recherche (slug → noms de plats), chargé seulement quand on tape une recherche :
// l'accueil reste léger (~260 Ko au lieu de ~740 Ko).
export const dynamic = 'force-static';

export function GET() {
  return Response.json(Object.fromEntries(getRestos().map((r) => [r.slug, r.plats])));
}
