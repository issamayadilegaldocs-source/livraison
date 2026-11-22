import { getRestos } from '@/lib/catalogue';

// Liste des restos (slug, nom) pour la page de config du livreur (/api/config).
export const dynamic = 'force-static';

export function GET() {
  return Response.json(getRestos().map((r) => ({ slug: r.slug, nom: r.nom })).sort((a, b) => a.nom.localeCompare(b.nom, 'fr')));
}
