'use client';

import { useEffect, useMemo, useState } from 'react';
import type { PlatCustom, PlatOverride, RestaurantGestion } from '@/lib/plateforme';

type RestoStatique = { slug: string; nom: string };
type PlatMenu = { id: number; nom: string; prix: number; description?: string; categorieId?: number };

const TYPES = [
  ['restaurants', 'Restaurant'],
  ['epicerie', 'Épicerie'],
  ['patisserie', 'Pâtisserie'],
  ['cafe', 'Café & jus'],
  ['fleurs', 'Fleurs'],
  ['para', 'Parapharmacie'],
  ['animaux', 'Animaux'],
] as const;

export default function RestaurantsPanel({
  gestions,
  onReload,
  mode = 'pc',
}: {
  gestions: RestaurantGestion[];
  onReload: () => Promise<void>;
  mode?: 'pc' | 'mobile';
}) {
  const [statiques, setStatiques] = useState<RestoStatique[]>([]);
  const [q, setQ] = useState('');
  const [filtre, setFiltre] = useState<'tous' | 'custom' | 'modifies' | 'desactives'>('tous');
  const [ajoutOuvert, setAjoutOuvert] = useState(false);
  const [edite, setEdite] = useState<{
    slug: string;
    source: 'override' | 'custom';
    actif: boolean;
    nom: string;
    adresse: string;
    telephone: string;
    email: string;
    cuisines: string;
    type_commerce: string;
    delai: string;
    image: string;
    lat: string;
    lng: string;
    modifs: Record<string, PlatOverride>;
    ajouts: PlatCustom[];
  } | null>(null);
  const [menuStatique, setMenuStatique] = useState<PlatMenu[]>([]);
  const [nouveauPlat, setNouveauPlat] = useState({ nom: '', prix: '', categorie: 'Spécialités', description: '' });
  const [envoi, setEnvoi] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState('');

  async function uploaderPhoto(file: File) {
    if (!edite) return;
    setUploading(true);
    setMsg('');
    try {
      const dataUrl = await new Promise<string>((ok, ko) => {
        const rd = new FileReader();
        rd.onload = () => ok(String(rd.result ?? ''));
        rd.onerror = ko;
        rd.readAsDataURL(file);
      });
      const res = await fetch('/api/admin/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ dataUrl, dossier: 'restos' }),
      });
      const d = await res.json().catch(() => null);
      if (!res.ok || !d?.url) return setMsg(d?.erreur ?? 'Upload impossible.');
      setEdite((cur) => (cur ? { ...cur, image: d.url } : cur));
      setMsg('✓ Photo importée ! Cliquez sur « Enregistrer et publier » pour valider.');
    } catch {
      setMsg('Erreur lors de l’envoi de l’image.');
    } finally {
      setUploading(false);
    }
  }

  useEffect(() => {
    fetch('/restos.json')
      .then((r) => (r.ok ? r.json() : []))
      .then((l) => Array.isArray(l) && setStatiques(l))
      .catch(() => {});
  }, []);

  const parSlug = useMemo(() => {
    const m = new Map<string, RestaurantGestion>();
    for (const g of gestions) m.set(g.slug, g);
    return m;
  }, [gestions]);

  const listeFusionnee = useMemo(() => {
    const customRows = gestions
      .filter((g) => g.source === 'custom')
      .map((g) => ({ slug: g.slug, nom: g.nom || g.slug, gestion: g, source: 'custom' as const }));
    const staticRows = statiques.map((s) => {
      const g = parSlug.get(s.slug);
      return { slug: s.slug, nom: g?.nom || s.nom, gestion: g, source: 'override' as const };
    });
    const all = [...customRows, ...staticRows];
    const term = q.trim().toLowerCase();
    return all.filter((r) => {
      if (filtre === 'custom' && r.source !== 'custom') return false;
      if (filtre === 'modifies' && !r.gestion) return false;
      if (filtre === 'desactives' && (r.gestion?.actif ?? true)) return false;
      if (!term) return true;
      return r.nom.toLowerCase().includes(term) || r.slug.includes(term);
    });
  }, [gestions, statiques, parSlug, q, filtre]);

  function ouvrirEdition(slug: string, nomDefaut: string, source: 'override' | 'custom') {
    const g = parSlug.get(slug);
    setMsg('');
    setEdite({
      slug,
      source: g?.source ?? source,
      actif: g?.actif ?? true,
      nom: g?.nom ?? nomDefaut,
      adresse: g?.adresse ?? '',
      telephone: g?.telephone ?? '',
      email: g?.email ?? '',
      cuisines: (g?.cuisines ?? []).join(', '),
      type_commerce: g?.type_commerce ?? 'restaurants',
      delai: g?.delai ?? '25-35 min',
      image: g?.image ?? '',
      lat: g?.position ? String(g.position.lat) : '34.7406',
      lng: g?.position ? String(g.position.lng) : '10.7603',
      modifs: { ...(g?.plats_overrides?.modifs ?? {}) },
      ajouts: [...(g?.plats_overrides?.ajouts ?? [])],
    });
    setMenuStatique([]);
    if (source === 'override') {
      fetch(`/menu-data/${slug}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((m) => m?.plats && setMenuStatique(m.plats))
        .catch(() => {});
    }
  }

  function ouvrirNouveau() {
    setAjoutOuvert(true);
    setMenuStatique([]);
    setMsg('');
    setEdite({
      slug: '',
      source: 'custom',
      actif: true,
      nom: '',
      adresse: 'Centre-ville, Sfax',
      telephone: '',
      email: '',
      cuisines: 'Tunisienne, Grillades',
      type_commerce: 'restaurants',
      delai: '25-35 min',
      image: '',
      lat: '34.7406',
      lng: '10.7603',
      modifs: {},
      ajouts: [],
    });
  }

  async function basculerActif(slug: string, nom: string, source: 'override' | 'custom', actifActuel: boolean) {
    await fetch('/api/admin/restaurants', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ slug, source, actif: !actifActuel, ...(source === 'custom' ? { nom } : {}) }),
    });
    await onReload();
  }

  async function enregistrerResto(e: React.FormEvent) {
    e.preventDefault();
    if (!edite) return;
    setEnvoi(true);
    setMsg('');
    try {
      const lat = Number(edite.lat);
      const lng = Number(edite.lng);
      const cuisines = edite.cuisines.split(',').map((s) => s.trim()).filter(Boolean);
      const res = await fetch('/api/admin/restaurants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          slug: edite.slug || undefined,
          source: edite.source,
          actif: edite.actif,
          nom: edite.nom,
          adresse: edite.adresse || null,
          telephone: edite.telephone || null,
          email: edite.email || null,
          cuisines: cuisines.length ? cuisines : null,
          type_commerce: edite.type_commerce,
          delai: edite.delai || null,
          image: edite.image || null,
          position: Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null,
          plats_overrides: { modifs: edite.modifs, ajouts: edite.ajouts },
        }),
      });
      const d = await res.json();
      if (!res.ok) return setMsg(d.erreur ?? 'Erreur enregistrement.');
      setMsg('Restaurant enregistré et publié en direct sur le site !');
      setAjoutOuvert(false);
      await onReload();
    } catch {
      setMsg('Erreur réseau.');
    } finally {
      setEnvoi(false);
    }
  }

  function ajouterPlatCustom() {
    if (!edite || !nouveauPlat.nom.trim()) return;
    const prix = Number(String(nouveauPlat.prix).replace(',', '.'));
    if (!Number.isFinite(prix) || prix < 0) return;
    const nextId = Math.max(900000, ...edite.ajouts.map((p) => p.id)) + 1;
    setEdite({
      ...edite,
      ajouts: [
        ...edite.ajouts,
        {
          id: nextId,
          nom: nouveauPlat.nom.trim(),
          prix,
          categorie: nouveauPlat.categorie.trim() || 'Carte',
          description: nouveauPlat.description.trim() || undefined,
          indispo: false,
        },
      ],
    });
    setNouveauPlat({ nom: '', prix: '', categorie: nouveauPlat.categorie, description: '' });
  }

  async function supprimerGestion(slug: string) {
    if (!confirm('Supprimer ce restaurant / réinitialiser ses modifications ?')) return;
    await fetch(`/api/admin/restaurants?slug=${encodeURIComponent(slug)}`, { method: 'DELETE', credentials: 'same-origin' });
    setEdite(null);
    await onReload();
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="m-0 text-base font-extrabold">🍽️ Restaurants & Menus ({listeFusionnee.length})</h2>
        <button type="button" onClick={ouvrirNouveau} className="h-10 rounded-xl bg-primary px-4 text-xs font-extrabold text-white">
          + Ajouter un restaurant
        </button>
      </div>

      {/* Éditeur restaurant + plats */}
      {edite && (
        <form onSubmit={enregistrerResto} className="rounded-3xl border-2 border-primary/20 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex items-center justify-between gap-2">
            <h3 className="m-0 text-base font-extrabold text-ink">
              {edite.source === 'custom' && !edite.slug ? 'Nouveau restaurant' : `Modifier : ${edite.nom || edite.slug}`}
            </h3>
            <button type="button" onClick={() => { setEdite(null); setAjoutOuvert(false); }} className="text-xs font-bold text-muted underline">
              Fermer
            </button>
          </div>

          {msg && <p className="mt-2 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800">{msg}</p>}

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="text-xs font-bold">
              Nom du restaurant *
              <input required value={edite.nom} onChange={(e) => setEdite({ ...edite, nom: e.target.value })} placeholder="Ex. Grill House Sfax" className="mt-1 w-full rounded-xl border border-black/10 px-3 py-2.5 text-sm" />
            </label>
            <label className="text-xs font-bold">
              Type de commerce
              <select value={edite.type_commerce} onChange={(e) => setEdite({ ...edite, type_commerce: e.target.value })} className="mt-1 w-full rounded-xl border border-black/10 bg-white px-3 py-2.5 text-sm">
                {TYPES.map(([k, l]) => (
                  <option key={k} value={k}>{l}</option>
                ))}
              </select>
            </label>
            <label className="text-xs font-bold">
              Adresse
              <input value={edite.adresse} onChange={(e) => setEdite({ ...edite, adresse: e.target.value })} className="mt-1 w-full rounded-xl border border-black/10 px-3 py-2.5 text-sm" />
            </label>
            <label className="text-xs font-bold">
              Téléphone / WhatsApp resto
              <input value={edite.telephone} onChange={(e) => setEdite({ ...edite, telephone: e.target.value })} placeholder="74 000 000" className="mt-1 w-full rounded-xl border border-black/10 px-3 py-2.5 text-sm" />
            </label>
            <label className="text-xs font-bold">
              Email resto (optionnel — notifié à chaque commande)
              <input type="email" value={edite.email} onChange={(e) => setEdite({ ...edite, email: e.target.value })} placeholder="resto@exemple.com" className="mt-1 w-full rounded-xl border border-black/10 px-3 py-2.5 text-sm" />
            </label>
            <label className="text-xs font-bold">
              Cuisines / catégories (virgule)
              <input value={edite.cuisines} onChange={(e) => setEdite({ ...edite, cuisines: e.target.value })} placeholder="Pizza, Makloub, Burger" className="mt-1 w-full rounded-xl border border-black/10 px-3 py-2.5 text-sm" />
            </label>
            <label className="text-xs font-bold">
              Délai estimé
              <input value={edite.delai} onChange={(e) => setEdite({ ...edite, delai: e.target.value })} placeholder="25-35 min" className="mt-1 w-full rounded-xl border border-black/10 px-3 py-2.5 text-sm" />
            </label>
            <div className="sm:col-span-2">
              <span className="text-xs font-bold">Photo / couverture (lien URL ou upload direct)</span>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <input
                  value={edite.image}
                  onChange={(e) => setEdite({ ...edite, image: e.target.value })}
                  placeholder="https://… ou importer une image →"
                  className="min-w-[200px] flex-1 rounded-xl border border-black/10 px-3 py-2.5 text-sm"
                />
                <label className="inline-flex h-10 cursor-pointer items-center gap-1.5 rounded-xl bg-ink px-3.5 text-xs font-extrabold text-white hover:opacity-90">
                  <span>{uploading ? 'Envoi…' : '📤 Importer une photo'}</span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    disabled={uploading}
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) uploaderPhoto(f);
                      e.target.value = '';
                    }}
                  />
                </label>
              </div>
              {edite.image && (
                <div className="mt-2 flex items-center gap-3">
                  <img src={edite.image} alt="" className="h-16 w-24 rounded-xl border border-black/10 object-cover" />
                  <button type="button" onClick={() => setEdite({ ...edite, image: '' })} className="text-xs font-bold text-red-700 underline">
                    Retirer la photo
                  </button>
                </div>
              )}
            </div>
            <label className="flex items-center gap-2 text-xs font-extrabold sm:col-span-2">
              <input type="checkbox" checked={edite.actif} onChange={(e) => setEdite({ ...edite, actif: e.target.checked })} className="h-4 w-4 accent-primary" />
              Restaurant actif et visible sur le site
            </label>
          </div>

          {/* Gestion des plats ajoutés */}
          <div className="mt-4 rounded-2xl bg-[#f6f7fb] p-3.5">
            <h4 className="m-0 text-xs font-extrabold uppercase text-ink">Plats ajoutés ({edite.ajouts.length})</h4>
            <div className="mt-2 grid gap-2 sm:grid-cols-4">
              <input
                value={nouveauPlat.nom}
                onChange={(e) => setNouveauPlat({ ...nouveauPlat, nom: e.target.value })}
                placeholder="Nom du plat"
                className="rounded-xl border border-black/10 bg-white px-3 py-2 text-xs"
              />
              <input
                value={nouveauPlat.prix}
                onChange={(e) => setNouveauPlat({ ...nouveauPlat, prix: e.target.value })}
                placeholder="Prix DT (ex. 12.5)"
                className="rounded-xl border border-black/10 bg-white px-3 py-2 text-xs"
              />
              <input
                value={nouveauPlat.categorie}
                onChange={(e) => setNouveauPlat({ ...nouveauPlat, categorie: e.target.value })}
                placeholder="Catégorie"
                className="rounded-xl border border-black/10 bg-white px-3 py-2 text-xs"
              />
              <button type="button" onClick={ajouterPlatCustom} className="h-9 rounded-xl bg-ink text-xs font-extrabold text-white">
                + Ajouter plat
              </button>
            </div>
            {edite.ajouts.length > 0 && (
              <div className="mt-2.5 flex flex-col gap-1.5">
                {edite.ajouts.map((p, idx) => (
                  <div key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white px-3 py-2 text-xs">
                    <span>
                      <b>{p.nom}</b> ({p.categorie}) — <b>{p.prix.toFixed(3)} DT</b> {p.indispo ? '· Indispo' : ''}
                    </span>
                    <div className="flex gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          const next = [...edite.ajouts];
                          next[idx] = { ...p, indispo: !p.indispo };
                          setEdite({ ...edite, ajouts: next });
                        }}
                        className="rounded-lg border border-black/10 px-2 py-1 font-bold"
                      >
                        {p.indispo ? 'Remettre dispo' : 'Indispo'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setEdite({ ...edite, ajouts: edite.ajouts.filter((_, i) => i !== idx) })}
                        className="rounded-lg bg-red-50 px-2 py-1 font-bold text-red-700"
                      >
                        Suppr.
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Plats existants du catalogue pour ce resto */}
          {menuStatique.length > 0 && (
            <details className="mt-3 rounded-2xl bg-[#f6f7fb] p-3.5">
              <summary className="cursor-pointer text-xs font-extrabold uppercase text-ink">
                Modifier les plats existants du menu ({menuStatique.length} plats)
              </summary>
              <div className="mt-2.5 flex max-h-72 flex-col gap-1.5 overflow-y-auto">
                {menuStatique.slice(0, 80).map((p) => {
                  const m = edite.modifs[String(p.id)] ?? {};
                  return (
                    <div key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white px-3 py-2 text-xs">
                      <span className={`min-w-0 flex-1 font-bold ${m.indispo ? 'text-red-600 line-through' : 'text-ink'}`}>
                        {m.nom ?? p.nom}
                      </span>
                      <input
                        type="number"
                        step="0.1"
                        defaultValue={m.prix ?? p.prix}
                        onBlur={(e) => {
                          const v = Number(e.target.value);
                          if (!Number.isFinite(v)) return;
                          setEdite({
                            ...edite,
                            modifs: { ...edite.modifs, [String(p.id)]: { ...m, prix: v } },
                          });
                        }}
                        className="w-20 rounded-lg border border-black/10 px-2 py-1 text-right font-bold"
                      />
                      <span className="text-[11px] text-muted">DT</span>
                      <button
                        type="button"
                        onClick={() =>
                          setEdite({
                            ...edite,
                            modifs: { ...edite.modifs, [String(p.id)]: { ...m, indispo: !m.indispo } },
                          })
                        }
                        className={`rounded-lg px-2.5 py-1 font-bold ${m.indispo ? 'bg-red-100 text-red-700' : 'border border-black/10'}`}
                      >
                        {m.indispo ? 'Indispo' : 'Dispo'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </details>
          )}

          <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
            {edite.slug && parSlug.has(edite.slug) ? (
              <button type="button" onClick={() => supprimerGestion(edite.slug)} className="h-10 rounded-xl bg-red-50 px-3.5 text-xs font-extrabold text-red-700">
                {edite.source === 'custom' ? 'Supprimer ce restaurant' : 'Réinitialiser aux valeurs d’origine'}
              </button>
            ) : (
              <span />
            )}
            <button type="submit" disabled={envoi} className="h-11 rounded-xl bg-primary px-6 text-sm font-extrabold text-white">
              {envoi ? 'Enregistrement…' : 'Enregistrer et publier'}
            </button>
          </div>
        </form>
      )}

      {/* Recherche et filtres */}
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Chercher un restaurant parmi les 298+…"
          className="h-11 min-w-[200px] flex-1 rounded-xl border border-black/10 bg-white px-3.5 text-sm outline-none focus:border-primary"
        />
        {([
          ['tous', 'Tous'],
          ['custom', 'Ajoutés'],
          ['modifies', 'Modifiés'],
          ['desactives', 'Désactivés'],
        ] as const).map(([k, l]) => (
          <button
            key={k}
            type="button"
            onClick={() => setFiltre(k)}
            className={`h-11 rounded-xl border px-3 text-xs font-extrabold ${filtre === k ? 'border-primary bg-primary text-white' : 'border-black/10 bg-white text-ink'}`}
          >
            {l}
          </button>
        ))}
      </div>

      {/* Liste des restaurants */}
      {mode === 'pc' ? (
        <div className="overflow-x-auto rounded-3xl border border-black/5 bg-white p-4 shadow-sm">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-black/10 text-[11px] font-extrabold uppercase text-muted">
                <th className="py-2.5 pr-3">Restaurant</th>
                <th className="py-2.5 pr-3">Source / Type</th>
                <th className="py-2.5 pr-3">Statut</th>
                <th className="py-2.5 pr-3">Lien public</th>
                <th className="py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {listeFusionnee.slice(0, 60).map((r) => {
                const actif = r.gestion?.actif ?? true;
                const lien = r.source === 'custom' ? `/resto-live?slug=${r.slug}` : `/resto/${r.slug}`;
                return (
                  <tr key={r.slug} className="border-b border-black/5 hover:bg-[#f8f9fc]">
                    <td className="py-2.5 pr-3">
                      <span className={`font-extrabold ${actif ? 'text-ink' : 'text-muted line-through'}`}>{r.nom}</span>
                    </td>
                    <td className="py-2.5 pr-3">
                      {r.source === 'custom' ? (
                        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-extrabold text-primary">Ajouté</span>
                      ) : r.gestion ? (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-extrabold text-amber-800">Modifié</span>
                      ) : (
                        <span className="text-muted">Catalogue</span>
                      )}
                    </td>
                    <td className="py-2.5 pr-3">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold ${actif ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-700'}`}>
                        {actif ? 'Actif' : 'Désactivé'}
                      </span>
                    </td>
                    <td className="py-2.5 pr-3">
                      <a href={lien} target="_blank" rel="noreferrer" className="text-primary underline">{lien}</a>
                    </td>
                    <td className="py-2.5 text-right">
                      <div className="inline-flex gap-1.5">
                        <button
                          type="button"
                          onClick={() => basculerActif(r.slug, r.nom, r.source, actif)}
                          className={`rounded-lg px-2.5 py-1 font-extrabold ${actif ? 'border border-black/10 bg-white text-ink' : 'bg-emerald-600 text-white'}`}
                        >
                          {actif ? 'Désactiver' : 'Réactiver'}
                        </button>
                        <button type="button" onClick={() => ouvrirEdition(r.slug, r.nom, r.source)} className="rounded-lg bg-ink px-2.5 py-1 font-extrabold text-white">
                          Modifier / Plats
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {listeFusionnee.length > 60 && (
            <p className="mt-3 text-center text-xs text-muted">
              Affichage des 60 premiers résultats sur {listeFusionnee.length}. Utilisez la recherche pour filtrer.
            </p>
          )}
        </div>
      ) : (
      <div className="flex flex-col gap-2">
        {listeFusionnee.slice(0, 60).map((r) => {
          const actif = r.gestion?.actif ?? true;
          return (
            <div key={r.slug} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-black/5 bg-white px-4 py-3 shadow-sm">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`font-extrabold ${actif ? 'text-ink' : 'text-muted line-through'}`}>{r.nom}</span>
                  {r.source === 'custom' && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-extrabold text-primary">Ajouté</span>}
                  {!actif && <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-extrabold text-red-700">Désactivé</span>}
                  {r.gestion && r.source === 'override' && actif && (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-extrabold text-amber-800">Modifié</span>
                  )}
                </div>
                <p className="m-0 text-[11px] text-muted">/{r.source === 'custom' ? `resto-live?slug=${r.slug}` : `resto/${r.slug}`}</p>
              </div>
              <div className="flex shrink-0 gap-1.5">
                <button
                  type="button"
                  onClick={() => basculerActif(r.slug, r.nom, r.source, actif)}
                  className={`h-9 rounded-xl px-3 text-xs font-extrabold ${actif ? 'border border-black/10 bg-white text-ink' : 'bg-emerald-600 text-white'}`}
                >
                  {actif ? 'Désactiver' : 'Réactiver'}
                </button>
                <button
                  type="button"
                  onClick={() => ouvrirEdition(r.slug, r.nom, r.source)}
                  className="h-9 rounded-xl bg-ink px-3 text-xs font-extrabold text-white"
                >
                  Modifier / Plats
                </button>
              </div>
            </div>
          );
        })}
        {listeFusionnee.length > 60 && (
          <p className="py-2 text-center text-xs text-muted">
            Affichage des 60 premiers résultats sur {listeFusionnee.length}. Utilisez la recherche pour filtrer.
          </p>
        )}
      </div>
      )}
      {ajoutOuvert && !edite && null}
    </div>
  );
}
