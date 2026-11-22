// Dump ZigZag d'une ville → données du site (data/). Pur sauf importer().
// Plain .mjs (pas de TS) pour que `node scripts/import.mjs` tourne sans build.
import fs from 'node:fs';
import path from 'node:path';

const mil = (n) => Math.round(Number(n || 0) * 1000);
const hhmm = (t) => String(t || '').slice(0, 5);

/** @returns {{jour:number, ouvre:string, ferme:string}[]} */
function horaires(raw) {
  if (!Array.isArray(raw.schedules)) return [];
  return raw.schedules
    .map((s) => ({ jour: Number(s.day), ouvre: hhmm(s.opening_time), ferme: hhmm(s.closing_time) }))
    .sort((a, b) => a.jour - b.jour || a.ouvre.localeCompare(b.ouvre));
}

function categoriesAvecPlats(raw, products) {
  const ids = new Set(products.filter((p) => p.status === 1).map((p) => p.category_id));
  return (raw.categories || []).filter((c) => ids.has(c.id)).map((c) => ({ id: c.id, nom: c.name }));
}

/** @returns {import('./catalogue').RestoIndex} */
export function mapResto(raw, products) {
  const actifs = products.filter((p) => p.status === 1);
  return {
    id: raw.id,
    slug: raw.slug || String(raw.id),
    nom: raw.name,
    adresse: raw.address || '',
    telephone: raw.phone || '',
    logo: raw.logo || null,
    couverture: raw.cover_photo || null,
    note: Number(raw.avg_rating) || 0,
    nbAvis: Array.isArray(raw.rating) ? raw.rating.reduce((s, n) => s + Number(n || 0), 0) : 0,
    delai: raw.delivery_time || '',
    cuisines: (raw.cuisine || []).map((c) => c.name),
    categories: categoriesAvecPlats(raw, products).map((c) => c.nom),
    horaires: horaires(raw),
    position: { lat: Number(raw.latitude), lng: Number(raw.longitude) },
    popularite: Number(raw.order_count) || 0,
    plats: [...new Set(actifs.map((p) => p.name))],
  };
}

function mapGroupe(v) {
  const obligatoire = v.required === 'on';
  const options = (v.values || []).map((o) => ({ label: o.label, prix: mil(o.optionPrice) / 1000 }));
  if (v.type === 'single') return { nom: v.name, type: 'single', obligatoire, min: obligatoire ? 1 : 0, max: 1, options };
  const max = Number(v.max) || options.length;
  return { nom: v.name, type: 'multi', obligatoire, min: obligatoire ? Math.max(1, Number(v.min) || 0) : 0, max, options };
}

function prix(p) {
  const base = mil(p.price);
  const d = Number(p.discount) || 0;
  const remise = d <= 0 ? 0 : p.discount_type === 'percent' ? Math.round((base * d) / 100) : mil(d);
  const final = Math.max(0, base - remise);
  return { prix: final / 1000, prixOrigine: remise > 0 ? base / 1000 : null };
}

/** @returns {import('./catalogue').Menu} */
export function mapMenu(raw, products, extra) {
  const populaires = new Set((extra && extra.popularProducts) || []);
  const categories = categoriesAvecPlats(raw, products);
  const ordre = new Map(categories.map((c, i) => [c.id, i]));
  const plats = products
    .filter((p) => p.status === 1 && ordre.has(p.category_id))
    .map((p) => ({
      id: p.id,
      nom: p.name,
      description: p.description || '',
      image: p.image || null,
      ...prix(p),
      categorieId: p.category_id,
      groupes: (p.variations || []).map(mapGroupe),
      populaire: populaires.has(p.id),
    }))
    .sort((a, b) => ordre.get(a.categorieId) - ordre.get(b.categorieId));
  return { restoId: raw.id, categories, plats };
}

const lireJson = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));

/** Lit `<dir>/restaurants|products|restaurants-extra/*.json` + cuisines.json, écrit `<out>/`. */
export function importer(dir, out) {
  fs.rmSync(path.join(out, 'menus'), { recursive: true, force: true });
  fs.mkdirSync(path.join(out, 'menus'), { recursive: true });
  const restos = [];
  let plats = 0;
  for (const f of fs.readdirSync(path.join(dir, 'restaurants'))) {
    const raw = lireJson(path.join(dir, 'restaurants', f));
    if (raw.active !== true || raw.status !== 1) continue;
    const pf = path.join(dir, 'products', f);
    const products = fs.existsSync(pf) ? lireJson(pf).products || [] : [];
    const ef = path.join(dir, 'restaurants-extra', f);
    const menu = mapMenu(raw, products, fs.existsSync(ef) ? lireJson(ef) : {});
    if (!menu.plats.length) continue;
    restos.push(mapResto(raw, products));
    plats += menu.plats.length;
    fs.writeFileSync(path.join(out, 'menus', `${raw.id}.json`), JSON.stringify(menu));
  }
  restos.sort((a, b) => b.popularite - a.popularite);
  fs.writeFileSync(path.join(out, 'restos.json'), JSON.stringify(restos));
  const cf = path.join(dir, 'cuisines.json');
  const cuisinesUtilisees = new Set(restos.flatMap((r) => r.cuisines));
  const cuisines = fs.existsSync(cf)
    ? (lireJson(cf).Cuisines || [])
        .filter((c) => c.status === 1 && cuisinesUtilisees.has(c.name))
        .map((c) => ({ nom: c.name, image: c.image || null }))
    : [];
  fs.writeFileSync(path.join(out, 'cuisines.json'), JSON.stringify(cuisines));
  return { restos: restos.length, plats, cuisines: cuisines.length };
}
