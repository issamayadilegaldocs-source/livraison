import { getRestos } from '@/lib/catalogue';

// Liste des restos (slug, nom, téléphone, adresse, position GPS) pour l'admin, le dispatch distance et la notification resto.
export const dynamic = 'force-static';

export function GET() {
  return Response.json(
    getRestos()
      .map((r) => ({
        slug: r.slug,
        nom: r.nom,
        telephone: r.telephone || '',
        adresse: r.adresse || '',
        position: r.position ?? null,
      }))
      .sort((a, b) => a.nom.localeCompare(b.nom, 'fr')),
  );
}
