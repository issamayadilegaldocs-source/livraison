import type { Metadata } from 'next';
import Link from '@/app/components/Lien';
import { getRestos, imageUrl } from '@/lib/catalogue';
import { filtresDispo } from '@/lib/filtres-plats';
import { T } from '@/lib/i18n';
import { vueClient } from '@/lib/commission';
import { getLivreur } from '@/lib/livreur';
import { NOMS_TYPES, TYPES, typesCommerce, type TypeCommerce } from '@/lib/types-commerce';
import Discovery, { type RestoAccueil } from '../../Discovery';

// Une page statique par type de commerce (tuiles de l'accueil), plus /c/tout pour la recherche de l'accueil.
type Type = TypeCommerce | 'tout';
export const dynamicParams = false;
export function generateStaticParams() {
  return [...TYPES, 'tout'].map((type) => ({ type }));
}

type Params = { params: Promise<{ type: Type }> };
const titre = (t: Type) => (t === 'tout' ? 'Tous les commerces' : NOMS_TYPES[t]);

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const l = getLivreur();
  return { title: `${titre((await params).type)} à ${l.ville} — ${l.nom}` };
}

export default async function Categorie({ params }: Params) {
  const { type } = await params;
  const l = getLivreur();
  const restos: RestoAccueil[] = getRestos()
    .filter((r) => type === 'tout' || typesCommerce(r).includes(type))
    .map((r) => ({
      slug: r.slug,
      nom: r.nom,
      logo: imageUrl('restaurant', r.logo, 'thumb'),
      couverture: imageUrl('restaurant', r.couverture, 'full'),
      note: r.note,
      nbAvis: r.nbAvis,
      delai: r.delai,
      cuisines: r.cuisines,
      categories: r.categories,
      popularite: r.popularite,
      horaires: r.horaires,
    }));
  // Filtres = ce qu'on mange (tacos, sandwich…), seulement pour les restaurants.
  const cuisines = type === 'restaurants' ? filtresDispo(restos).map((nom) => ({ nom, image: null })) : [];
  return (
    <>
      <div className="pt-4">
        <Link href="/" className="text-sm font-semibold text-muted hover:underline">
          <T k="← Accueil" />
        </Link>
      </div>
      <Discovery restos={restos} cuisines={cuisines} promos={(l.promos ?? []).filter((p) => p.actif && !p.code).map(vueClient)} titre={titre(type)} typeCommerce={type} livreur={{ nom: l.nom, slogan: l.slogan, ville: l.ville, service: l.service }} />
    </>
  );
}
