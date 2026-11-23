'use client';

import { useEffect, useState } from 'react';
import type { Promo } from '@/lib/commission';
import type { Config } from '@/lib/config';

type ReglagesApi = {
  config: Config;
  effectif: {
    service?: { ouvre: string; ferme: string };
    livraison: { base: number; parKm: number; min: number; max: number; rayonMaxKm: number; facteurRoute: number };
    fraisService: { pourcent: number; min: number; max: number } | null;
    livraisonGratuite: { min?: number } | null;
    colis: {
      actif: boolean;
      livraison: { base: number; parKm: number; min: number; max: number; rayonMaxKm: number };
      supplements: { petit: number; moyen: number; grand: number };
      urgent: number;
      nuit: { de: string; a: string; montant: number } | null;
    };
    commission: { restos?: Record<string, number> };
    promos: Promo[];
    commandeMin: number | null;
    supplement: {
      manuel?: { actif: boolean; nom: string; montant: number };
      nuit?: { actif: boolean; de: string; a: string; montant: number };
    } | null;
    annonce: string | null;
    pourboires: number[];
  };
  pauseActive: boolean;
};

type RestoSimple = { slug: string; nom: string };

const num = (v: string, def = 0) => {
  const n = Number(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : def;
};

const inp = 'mt-1 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm outline-none focus:border-primary';

export default function ReglagesPanel({
  data,
  onSave,
}: {
  data: ReglagesApi | null;
  onSave: (patch: Record<string, unknown>) => Promise<string | null>;
}) {
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState<string | null>(null);
  const [restos, setRestos] = useState<RestoSimple[]>([]);

  // États locaux synchronisés avec `data`
  const [retour, setRetour] = useState('');
  const [horairesActif, setHorairesActif] = useState(false);
  const [ouvre, setOuvre] = useState('11:00');
  const [ferme, setFerme] = useState('23:30');

  const [frais, setFrais] = useState({ base: '1', parKm: '0.5', min: '1', max: '12', rayonMaxKm: '15' });
  const [livGratActif, setLivGratActif] = useState(false);
  const [livGratMin, setLivGratMin] = useState('');

  const [fsActif, setFsActif] = useState(false);
  const [fsPct, setFsPct] = useState('8');
  const [fsMin, setFsMin] = useState('0.8');
  const [fsMax, setFsMax] = useState('5');

  const [supManActif, setSupManActif] = useState(false);
  const [supManNom, setSupManNom] = useState('Pluie / Rush');
  const [supManMt, setSupManMt] = useState('1');
  const [supNuitActif, setSupNuitActif] = useState(false);
  const [supNuitDe, setSupNuitDe] = useState('22:00');
  const [supNuitA, setSupNuitA] = useState('06:00');
  const [supNuitMt, setSupNuitMt] = useState('1');

  const [cmdMin, setCmdMin] = useState('');
  const [annonce, setAnnonce] = useState('');
  const [pourboires, setPourboires] = useState('1, 2, 3, 5');

  const [colis, setColis] = useState({
    actif: true, base: '2', parKm: '1', min: '3', max: '20', rayonMaxKm: '10', moyen: '1', grand: '2.5', urgent: '0',
    nuitActif: false, nuitDe: '22:00', nuitA: '06:00', nuitMt: '2',
  });

  // Commission par resto
  const [commResto, setCommResto] = useState('');
  const [commPct, setCommPct] = useState('10');

  // Nouvelle promo / coupon
  const [promoForm, setPromoForm] = useState({
    estCoupon: false,
    nom: '',
    code: '',
    type: 'pourcent' as 'pourcent' | 'montant',
    valeur: '10',
    max: '',
    min: '',
    resto: '',
    financeur: 'livreur' as 'livreur' | 'resto' | 'partage',
    partResto: '50',
    cumulable: false,
    limite: '',
  });

  useEffect(() => {
    fetch('/restos.json')
      .then((r) => (r.ok ? r.json() : []))
      .then((l) => Array.isArray(l) && setRestos(l))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!data) return;
    const { config, effectif } = data;
    setRetour(config.retour ?? '');
    setHorairesActif(Boolean(effectif.service));
    setOuvre(effectif.service?.ouvre ?? '11:00');
    setFerme(effectif.service?.ferme ?? '23:30');
    setFrais({
      base: String(effectif.livraison.base),
      parKm: String(effectif.livraison.parKm),
      min: String(effectif.livraison.min),
      max: String(effectif.livraison.max),
      rayonMaxKm: String(effectif.livraison.rayonMaxKm),
    });
    setLivGratActif(Boolean(effectif.livraisonGratuite));
    setLivGratMin(effectif.livraisonGratuite?.min !== undefined ? String(effectif.livraisonGratuite.min) : '');
    setFsActif(Boolean(effectif.fraisService));
    setFsPct(String(effectif.fraisService?.pourcent ?? 8));
    setFsMin(String(effectif.fraisService?.min ?? 0.8));
    setFsMax(String(effectif.fraisService?.max ?? 5));
    setSupManActif(Boolean(effectif.supplement?.manuel?.actif));
    setSupManNom(effectif.supplement?.manuel?.nom ?? 'Pluie / Rush');
    setSupManMt(String(effectif.supplement?.manuel?.montant ?? 1));
    setSupNuitActif(Boolean(effectif.supplement?.nuit?.actif));
    setSupNuitDe(effectif.supplement?.nuit?.de ?? '22:00');
    setSupNuitA(effectif.supplement?.nuit?.a ?? '06:00');
    setSupNuitMt(String(effectif.supplement?.nuit?.montant ?? 1));
    setCmdMin(effectif.commandeMin !== null ? String(effectif.commandeMin) : '');
    setAnnonce(effectif.annonce ?? '');
    setPourboires(effectif.pourboires.join(', '));
    setColis({
      actif: effectif.colis.actif,
      base: String(effectif.colis.livraison.base),
      parKm: String(effectif.colis.livraison.parKm),
      min: String(effectif.colis.livraison.min),
      max: String(effectif.colis.livraison.max),
      rayonMaxKm: String(effectif.colis.livraison.rayonMaxKm),
      moyen: String(effectif.colis.supplements.moyen),
      grand: String(effectif.colis.supplements.grand),
      urgent: String(effectif.colis.urgent),
      nuitActif: Boolean(effectif.colis.nuit),
      nuitDe: effectif.colis.nuit?.de ?? '22:00',
      nuitA: effectif.colis.nuit?.a ?? '06:00',
      nuitMt: String(effectif.colis.nuit?.montant ?? 2),
    });
  }, [data]);

  if (!data) {
    return <div className="rounded-3xl bg-white p-6 text-center text-sm text-muted">Chargement des réglages…</div>;
  }

  async function enregistrer(bloc: string, patch: Record<string, unknown>, label: string) {
    setSaving(bloc);
    setMsg('');
    setErr('');
    const erreur = await onSave(patch);
    setSaving(null);
    if (erreur) setErr(erreur);
    else setMsg(`✓ ${label} enregistré et actif en direct sur le site.`);
  }

  const promosActuelles: Promo[] = data.effectif.promos ?? [];
  const commissionsRestos = data.effectif.commission?.restos ?? {};

  async function ajouterPromo(e: React.FormEvent) {
    e.preventDefault();
    const id = `${promoForm.estCoupon ? 'cpn' : 'prm'}${Date.now().toString(36).slice(-5)}`;
    const code = promoForm.estCoupon ? promoForm.code.trim().toUpperCase() : undefined;
    const nom = promoForm.estCoupon ? (code || 'COUPON') : promoForm.nom.trim();
    if (!nom) return setErr('Indiquez un nom ou un code.');
    const nouvelle: Promo = {
      id,
      nom,
      type: promoForm.type,
      valeur: num(promoForm.valeur, 10),
      ...(promoForm.max.trim() ? { max: num(promoForm.max) } : {}),
      ...(promoForm.min.trim() ? { min: num(promoForm.min) } : {}),
      ...(promoForm.resto ? { resto: promoForm.resto } : {}),
      ...(code ? { code } : {}),
      ...(promoForm.estCoupon && promoForm.cumulable ? { cumulable: true } : {}),
      ...(promoForm.estCoupon && promoForm.limite.trim() ? { limite: Math.max(1, Math.round(num(promoForm.limite, 1))) } : {}),
      financeur: promoForm.financeur,
      ...(promoForm.financeur === 'partage' ? { partResto: num(promoForm.partResto, 50) } : {}),
      actif: true,
    };
    await enregistrer('promo', { promos: [...promosActuelles, nouvelle] }, promoForm.estCoupon ? `Coupon ${code}` : `Promotion « ${nom} »`);
    setPromoForm({ ...promoForm, nom: '', code: '' });
  }

  return (
    <div className="flex flex-col gap-4">
      {err && <div className="rounded-2xl bg-red-50 px-4 py-3 text-xs font-extrabold text-red-700">❌ {err}</div>}
      {msg && <div className="rounded-2xl bg-emerald-50 px-4 py-3 text-xs font-extrabold text-emerald-800">{msg}</div>}

      {/* Raccourcis directs vers l'appli livreur téléphone (sans ?cle=) */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-3xl border border-primary/20 bg-primary/5 p-4">
        <div>
          <p className="m-0 text-sm font-extrabold text-ink">📱 Outils livreur mobile (connectés par votre session Admin, sans clé URL)</p>
          <p className="m-0 text-xs text-muted">Double prix resto/client, alertes push sonores et mode téléphone plein écran :</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a href="/api/config" className="inline-flex h-10 items-center rounded-xl bg-ink px-3.5 text-xs font-extrabold text-white">
            📱 Appli téléphone complète
          </a>
          <a href="/api/config#prix" className="inline-flex h-10 items-center rounded-xl border border-black/10 bg-white px-3.5 text-xs font-extrabold text-ink">
            💰 Double prix resto/marge
          </a>
          <a href="/api/config#simple" className="inline-flex h-10 items-center rounded-xl border border-black/10 bg-white px-3.5 text-xs font-extrabold text-ink">
            ⚡ Prix rapide 1 plat
          </a>
          <a href="/api/push" className="inline-flex h-10 items-center rounded-xl bg-amber-500 px-3.5 text-xs font-extrabold text-white">
            🔔 Activer alertes Push
          </a>
        </div>
      </div>

      {/* Grille 2 colonnes sur PC, 1 colonne sur téléphone */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* 1. Pause / Reprise */}
        <section className="rounded-3xl border border-black/5 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="m-0 text-base font-extrabold">🚦 Statut du service</h3>
              <p className="m-0 text-xs text-muted">
                {data.pauseActive ? 'Site en pause : les commandes sont bloquées.' : 'Site ouvert : les clients peuvent commander.'}
              </p>
            </div>
            <button
              type="button"
              disabled={saving === 'pause'}
              onClick={() =>
                enregistrer(
                  'pause',
                  data.pauseActive ? { pause: false, retour: undefined } : { pause: true, ...(retour ? { retour } : {}) },
                  data.pauseActive ? 'Service repris' : 'Service mis en pause',
                )
              }
              className={`h-11 rounded-2xl px-4 text-xs font-extrabold text-white ${data.pauseActive ? 'bg-emerald-600' : 'bg-red-600'}`}
            >
              {data.pauseActive ? '▶ Reprendre les commandes' : '⏸ Mettre en pause'}
            </button>
          </div>
          {!data.pauseActive && (
            <label className="mt-3 block text-xs font-bold text-muted">
              Heure de retour automatique (optionnel, ex. 2026-11-23T19:30)
              <input type="datetime-local" value={retour} onChange={(e) => setRetour(e.target.value)} className={inp} />
            </label>
          )}
        </section>

        {/* 2. Horaires */}
        <section className="rounded-3xl border border-black/5 bg-white p-5 shadow-sm">
          <h3 className="m-0 text-base font-extrabold">⏰ Horaires automatiques (heure de Tunis)</h3>
          <label className="mt-2 flex items-center gap-2 text-xs font-extrabold">
            <input type="checkbox" checked={horairesActif} onChange={(e) => setHorairesActif(e.target.checked)} className="h-4 w-4 accent-primary" />
            Fermer automatiquement en dehors de cette plage
          </label>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <label className="text-xs font-bold">
              Ouverture
              <input type="time" disabled={!horairesActif} value={ouvre} onChange={(e) => setOuvre(e.target.value)} className={inp} />
            </label>
            <label className="text-xs font-bold">
              Fermeture
              <input type="time" disabled={!horairesActif} value={ferme} onChange={(e) => setFerme(e.target.value)} className={inp} />
            </label>
          </div>
          <button
            type="button"
            disabled={saving === 'horaires'}
            onClick={() => enregistrer('horaires', { service: horairesActif ? { ouvre, ferme } : null }, 'Horaires')}
            className="mt-3 h-10 rounded-xl bg-primary px-4 text-xs font-extrabold text-white"
          >
            Enregistrer les horaires
          </button>
        </section>

        {/* 3. Frais de livraison */}
        <section className="rounded-3xl border border-black/5 bg-white p-5 shadow-sm">
          <h3 className="m-0 text-base font-extrabold">🛵 Frais de livraison (repas)</h3>
          <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            <label className="text-xs font-bold">Départ (DT)<input type="number" step="0.1" value={frais.base} onChange={(e) => setFrais({ ...frais, base: e.target.value })} className={inp} /></label>
            <label className="text-xs font-bold">Par km (DT)<input type="number" step="0.1" value={frais.parKm} onChange={(e) => setFrais({ ...frais, parKm: e.target.value })} className={inp} /></label>
            <label className="text-xs font-bold">Minimum (DT)<input type="number" step="0.1" value={frais.min} onChange={(e) => setFrais({ ...frais, min: e.target.value })} className={inp} /></label>
            <label className="text-xs font-bold">Maximum (DT)<input type="number" step="0.1" value={frais.max} onChange={(e) => setFrais({ ...frais, max: e.target.value })} className={inp} /></label>
            <label className="text-xs font-bold">Rayon max (km)<input type="number" step="1" value={frais.rayonMaxKm} onChange={(e) => setFrais({ ...frais, rayonMaxKm: e.target.value })} className={inp} /></label>
          </div>
          <button
            type="button"
            disabled={saving === 'frais'}
            onClick={() =>
              enregistrer(
                'frais',
                { frais: { base: num(frais.base, 1), parKm: num(frais.parKm, 0.5), min: num(frais.min, 1), max: num(frais.max, 12), rayonMaxKm: num(frais.rayonMaxKm, 15) } },
                'Frais de livraison',
              )
            }
            className="mt-3 h-10 rounded-xl bg-primary px-4 text-xs font-extrabold text-white"
          >
            Enregistrer les frais
          </button>
        </section>

        {/* 4. Livraison gratuite & Frais de service */}
        <section className="rounded-3xl border border-black/5 bg-white p-5 shadow-sm">
          <h3 className="m-0 text-base font-extrabold">🎁 Livraison gratuite & Frais de service</h3>
          <div className="mt-3 rounded-2xl bg-[#f6f7fb] p-3">
            <label className="flex items-center gap-2 text-xs font-extrabold">
              <input type="checkbox" checked={livGratActif} onChange={(e) => setLivGratActif(e.target.checked)} className="h-4 w-4 accent-primary" />
              Activer la livraison gratuite (bandeau sur tout le site)
            </label>
            {livGratActif && (
              <label className="mt-2 block text-xs font-bold">
                Panier minimum (DT, vide = gratuit pour tous)
                <input type="number" step="1" value={livGratMin} onChange={(e) => setLivGratMin(e.target.value)} placeholder="Ex. 30" className={inp} />
              </label>
            )}
            <button
              type="button"
              disabled={saving === 'livgrat'}
              onClick={() =>
                enregistrer(
                  'livgrat',
                  { livraisonGratuite: livGratActif ? (livGratMin.trim() ? { min: num(livGratMin) } : {}) : null },
                  'Livraison gratuite',
                )
              }
              className="mt-2.5 h-9 rounded-xl bg-emerald-700 px-3.5 text-xs font-extrabold text-white"
            >
              Enregistrer livraison gratuite
            </button>
          </div>

          <div className="mt-3 rounded-2xl bg-[#f6f7fb] p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="flex items-center gap-2 text-xs font-extrabold">
                <input type="checkbox" checked={fsActif} onChange={(e) => setFsActif(e.target.checked)} className="h-4 w-4 accent-primary" />
                Frais de service (% du panier)
              </label>
              <button
                type="button"
                onClick={() => { setFsActif(true); setFsPct('8'); setFsMin('0.8'); setFsMax('5'); }}
                className="text-[11px] font-bold text-primary underline"
              >
                Formule Zigzag (8%)
              </button>
            </div>
            {fsActif && (
              <div className="mt-2 grid grid-cols-3 gap-2">
                <label className="text-xs font-bold">%<input type="number" step="0.5" value={fsPct} onChange={(e) => setFsPct(e.target.value)} className={inp} /></label>
                <label className="text-xs font-bold">Min DT<input type="number" step="0.1" value={fsMin} onChange={(e) => setFsMin(e.target.value)} className={inp} /></label>
                <label className="text-xs font-bold">Max DT<input type="number" step="0.5" value={fsMax} onChange={(e) => setFsMax(e.target.value)} className={inp} /></label>
              </div>
            )}
            <button
              type="button"
              disabled={saving === 'fs'}
              onClick={() =>
                enregistrer(
                  'fs',
                  { fraisService: fsActif ? { pourcent: num(fsPct, 8), min: num(fsMin, 0.8), max: num(fsMax, 5) } : null },
                  'Frais de service',
                )
              }
              className="mt-2.5 h-9 rounded-xl bg-primary px-3.5 text-xs font-extrabold text-white"
            >
              Enregistrer frais de service
            </button>
          </div>
        </section>

        {/* 5. Supplément pluie / nuit */}
        <section className="rounded-3xl border border-black/5 bg-white p-5 shadow-sm">
          <h3 className="m-0 text-base font-extrabold">🌧️ Supplément pluie / rush & nuit</h3>
          <div className="mt-3 flex flex-col gap-3">
            <div className="rounded-2xl bg-[#f6f7fb] p-3">
              <label className="flex items-center gap-2 text-xs font-extrabold">
                <input type="checkbox" checked={supManActif} onChange={(e) => setSupManActif(e.target.checked)} className="h-4 w-4 accent-primary" />
                Supplément manuel actif maintenant
              </label>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <label className="text-xs font-bold">Nom<input value={supManNom} onChange={(e) => setSupManNom(e.target.value)} className={inp} /></label>
                <label className="text-xs font-bold">Montant (DT)<input type="number" step="0.5" value={supManMt} onChange={(e) => setSupManMt(e.target.value)} className={inp} /></label>
              </div>
            </div>
            <div className="rounded-2xl bg-[#f6f7fb] p-3">
              <label className="flex items-center gap-2 text-xs font-extrabold">
                <input type="checkbox" checked={supNuitActif} onChange={(e) => setSupNuitActif(e.target.checked)} className="h-4 w-4 accent-primary" />
                Supplément nuit automatique
              </label>
              <div className="mt-2 grid grid-cols-3 gap-2">
                <label className="text-xs font-bold">De<input type="time" value={supNuitDe} onChange={(e) => setSupNuitDe(e.target.value)} className={inp} /></label>
                <label className="text-xs font-bold">À<input type="time" value={supNuitA} onChange={(e) => setSupNuitA(e.target.value)} className={inp} /></label>
                <label className="text-xs font-bold">DT<input type="number" step="0.5" value={supNuitMt} onChange={(e) => setSupNuitMt(e.target.value)} className={inp} /></label>
              </div>
            </div>
            <button
              type="button"
              disabled={saving === 'sup'}
              onClick={() =>
                enregistrer(
                  'sup',
                  {
                    supplement: {
                      manuel: { actif: supManActif, nom: supManNom.trim() || 'Pluie / Rush', montant: num(supManMt, 1) },
                      nuit: { actif: supNuitActif, de: supNuitDe, a: supNuitA, montant: num(supNuitMt, 1) },
                    },
                  },
                  'Suppléments pluie/nuit',
                )
              }
              className="h-10 self-start rounded-xl bg-primary px-4 text-xs font-extrabold text-white"
            >
              Enregistrer les suppléments
            </button>
          </div>
        </section>

        {/* 6. Annonce, Minimum & Pourboires */}
        <section className="rounded-3xl border border-black/5 bg-white p-5 shadow-sm">
          <h3 className="m-0 text-base font-extrabold">📢 Annonce, Commande min & Pourboires</h3>
          <div className="mt-3 flex flex-col gap-2.5">
            <label className="text-xs font-bold">
              Message d’annonce en haut de tout le site (vide = masqué)
              <input maxLength={140} value={annonce} onChange={(e) => setAnnonce(e.target.value)} placeholder="Ex. Livraison rapide sur tout Sfax !" className={inp} />
            </label>
            <div className="grid grid-cols-2 gap-2.5">
              <label className="text-xs font-bold">
                Commande minimum (DT)
                <input type="number" step="1" value={cmdMin} onChange={(e) => setCmdMin(e.target.value)} placeholder="Aucun" className={inp} />
              </label>
              <label className="text-xs font-bold">
                Boutons pourboire (virgule)
                <input value={pourboires} onChange={(e) => setPourboires(e.target.value)} placeholder="1, 2, 3, 5" className={inp} />
              </label>
            </div>
            <button
              type="button"
              disabled={saving === 'regles'}
              onClick={() => {
                const listeP = pourboires
                  .split(',')
                  .map((s) => num(s, -1))
                  .filter((n) => n > 0 && n <= 50)
                  .slice(0, 6);
                enregistrer(
                  'regles',
                  {
                    annonce: annonce.trim() || null,
                    commandeMin: cmdMin.trim() ? num(cmdMin) : null,
                    ...(listeP.length ? { pourboires: listeP } : {}),
                  },
                  'Annonce, minimum et pourboires',
                );
              }}
              className="mt-1 h-10 self-start rounded-xl bg-primary px-4 text-xs font-extrabold text-white"
            >
              Enregistrer ces règles
            </button>
          </div>
        </section>

        {/* 7. Tarif des colis */}
        <section className="rounded-3xl border border-black/5 bg-white p-5 shadow-sm lg:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="m-0 text-base font-extrabold">📦 Tarif des colis</h3>
            <label className="flex items-center gap-2 text-xs font-extrabold">
              <input type="checkbox" checked={colis.actif} onChange={(e) => setColis({ ...colis, actif: e.target.checked })} className="h-4 w-4 accent-primary" />
              Service colis actif
            </label>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-4 lg:grid-cols-8">
            <label className="text-xs font-bold">Départ<input type="number" step="0.5" value={colis.base} onChange={(e) => setColis({ ...colis, base: e.target.value })} className={inp} /></label>
            <label className="text-xs font-bold">Par km<input type="number" step="0.1" value={colis.parKm} onChange={(e) => setColis({ ...colis, parKm: e.target.value })} className={inp} /></label>
            <label className="text-xs font-bold">Min DT<input type="number" step="0.5" value={colis.min} onChange={(e) => setColis({ ...colis, min: e.target.value })} className={inp} /></label>
            <label className="text-xs font-bold">Max DT<input type="number" step="1" value={colis.max} onChange={(e) => setColis({ ...colis, max: e.target.value })} className={inp} /></label>
            <label className="text-xs font-bold">Rayon km<input type="number" step="1" value={colis.rayonMaxKm} onChange={(e) => setColis({ ...colis, rayonMaxKm: e.target.value })} className={inp} /></label>
            <label className="text-xs font-bold">+ Moyen<input type="number" step="0.5" value={colis.moyen} onChange={(e) => setColis({ ...colis, moyen: e.target.value })} className={inp} /></label>
            <label className="text-xs font-bold">+ Grand<input type="number" step="0.5" value={colis.grand} onChange={(e) => setColis({ ...colis, grand: e.target.value })} className={inp} /></label>
            <label className="text-xs font-bold">+ Urgent<input type="number" step="0.5" value={colis.urgent} onChange={(e) => setColis({ ...colis, urgent: e.target.value })} className={inp} /></label>
          </div>
          <button
            type="button"
            disabled={saving === 'colis'}
            onClick={() =>
              enregistrer(
                'colis',
                {
                  colis: {
                    actif: colis.actif,
                    base: num(colis.base, 2),
                    parKm: num(colis.parKm, 1),
                    min: num(colis.min, 3),
                    max: num(colis.max, 20),
                    rayonMaxKm: num(colis.rayonMaxKm, 10),
                    moyen: num(colis.moyen, 1),
                    grand: num(colis.grand, 2.5),
                    urgent: num(colis.urgent, 0),
                    ...(colis.nuitActif ? { nuit: { de: colis.nuitDe, a: colis.nuitA, montant: num(colis.nuitMt, 2) } } : {}),
                  },
                },
                'Tarif des colis',
              )
            }
            className="mt-3 h-10 rounded-xl bg-primary px-4 text-xs font-extrabold text-white"
          >
            Enregistrer tarif colis
          </button>
        </section>

        {/* 8. Promotions automatiques & Coupons */}
        <section className="rounded-3xl border border-black/5 bg-white p-5 shadow-sm lg:col-span-2">
          <h3 className="m-0 text-base font-extrabold">🏷️ Promotions automatiques & 🎟️ Coupons ({promosActuelles.length})</h3>
          {promosActuelles.length > 0 && (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-black/10 text-muted">
                    <th className="py-2 pr-3">Type</th>
                    <th className="py-2 pr-3">Nom / Code</th>
                    <th className="py-2 pr-3">Remise</th>
                    <th className="py-2 pr-3">Cible</th>
                    <th className="py-2 pr-3">Qui paie</th>
                    <th className="py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {promosActuelles.map((p) => (
                    <tr key={p.id} className="border-b border-black/5">
                      <td className="py-2 pr-3 font-bold">{p.code ? '🎟️ Coupon' : '🏷️ Promo'}</td>
                      <td className="py-2 pr-3 font-extrabold text-ink">{p.code ? `${p.code}` : p.nom}</td>
                      <td className="py-2 pr-3">
                        −{p.valeur}{p.type === 'pourcent' ? '%' : ' DT'}
                        {p.max ? ` (max ${p.max} DT)` : ''}
                        {p.min ? ` · dès ${p.min} DT` : ''}
                      </td>
                      <td className="py-2 pr-3">{p.resto ?? 'Tous'}</td>
                      <td className="py-2 pr-3">{p.financeur === 'partage' ? `Partagé (${p.partResto ?? 50}% resto)` : p.financeur}</td>
                      <td className="py-2 text-right">
                        <div className="inline-flex gap-1.5">
                          <button
                            type="button"
                            onClick={() =>
                              enregistrer(
                                'promo-t',
                                { promos: promosActuelles.map((x) => (x.id === p.id ? { ...x, actif: !x.actif } : x)) },
                                'Statut promo',
                              )
                            }
                            className={`rounded-lg px-2.5 py-1 font-bold ${p.actif ? 'bg-emerald-100 text-emerald-800' : 'bg-black/10 text-muted'}`}
                          >
                            {p.actif ? 'Actif' : 'Pause'}
                          </button>
                          <button
                            type="button"
                            onClick={() => enregistrer('promo-d', { promos: promosActuelles.filter((x) => x.id !== p.id) }, 'Promo supprimée')}
                            className="rounded-lg bg-red-50 px-2.5 py-1 font-bold text-red-700"
                          >
                            Suppr.
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <form onSubmit={ajouterPromo} className="mt-4 grid gap-2.5 rounded-2xl bg-[#f6f7fb] p-3.5 sm:grid-cols-4">
            <label className="text-xs font-bold">
              Genre
              <select
                value={promoForm.estCoupon ? 'coupon' : 'promo'}
                onChange={(e) => setPromoForm({ ...promoForm, estCoupon: e.target.value === 'coupon' })}
                className={inp}
              >
                <option value="promo">🏷️ Promo automatique</option>
                <option value="coupon">🎟️ Coupon (code secret)</option>
              </select>
            </label>
            {promoForm.estCoupon ? (
              <label className="text-xs font-bold">
                Code (ex. BIENVENUE10) *
                <input required value={promoForm.code} onChange={(e) => setPromoForm({ ...promoForm, code: e.target.value.toUpperCase() })} className={inp} />
              </label>
            ) : (
              <label className="text-xs font-bold">
                Nom de la promo *
                <input required value={promoForm.nom} onChange={(e) => setPromoForm({ ...promoForm, nom: e.target.value })} placeholder="Ex. Weekend -10%" className={inp} />
              </label>
            )}
            <label className="text-xs font-bold">
              Type remise
              <select value={promoForm.type} onChange={(e) => setPromoForm({ ...promoForm, type: e.target.value as 'pourcent' | 'montant' })} className={inp}>
                <option value="pourcent">Pourcentage (%)</option>
                <option value="montant">Montant fixe (DT)</option>
              </select>
            </label>
            <label className="text-xs font-bold">
              Valeur ({promoForm.type === 'pourcent' ? '%' : 'DT'})
              <input type="number" step="0.5" value={promoForm.valeur} onChange={(e) => setPromoForm({ ...promoForm, valeur: e.target.value })} className={inp} />
            </label>
            <label className="text-xs font-bold">
              Panier min (DT)
              <input type="number" step="1" value={promoForm.min} onChange={(e) => setPromoForm({ ...promoForm, min: e.target.value })} placeholder="0" className={inp} />
            </label>
            <label className="text-xs font-bold">
              Plafond max (DT)
              <input type="number" step="0.5" value={promoForm.max} onChange={(e) => setPromoForm({ ...promoForm, max: e.target.value })} placeholder="Aucun" className={inp} />
            </label>
            <label className="text-xs font-bold">
              Restaurant (optionnel)
              <select value={promoForm.resto} onChange={(e) => setPromoForm({ ...promoForm, resto: e.target.value })} className={inp}>
                <option value="">Tous les restos</option>
                {restos.map((r) => (
                  <option key={r.slug} value={r.slug}>{r.nom}</option>
                ))}
              </select>
            </label>
            <label className="text-xs font-bold">
              Qui paie ?
              <select value={promoForm.financeur} onChange={(e) => setPromoForm({ ...promoForm, financeur: e.target.value as 'livreur' | 'resto' | 'partage' })} className={inp}>
                <option value="livreur">Livreur</option>
                <option value="resto">Restaurant</option>
                <option value="partage">Partagé</option>
              </select>
            </label>
            {promoForm.estCoupon && (
              <>
                <label className="text-xs font-bold">
                  Limite d’usages
                  <input type="number" step="1" value={promoForm.limite} onChange={(e) => setPromoForm({ ...promoForm, limite: e.target.value })} placeholder="Illimité" className={inp} />
                </label>
                <label className="flex items-center gap-2 self-end pb-2 text-xs font-bold">
                  <input type="checkbox" checked={promoForm.cumulable} onChange={(e) => setPromoForm({ ...promoForm, cumulable: e.target.checked })} className="h-4 w-4 accent-primary" />
                  Cumulable avec promos
                </label>
              </>
            )}
            <div className="flex items-end sm:col-span-2">
              <button type="submit" disabled={saving === 'promo'} className="h-10 rounded-xl bg-ink px-5 text-xs font-extrabold text-white">
                + Ajouter {promoForm.estCoupon ? 'le coupon' : 'la promotion'}
              </button>
            </div>
          </form>
        </section>

        {/* 9. Commission par restaurant */}
        <section className="rounded-3xl border border-black/5 bg-white p-5 shadow-sm lg:col-span-2">
          <h3 className="m-0 text-base font-extrabold">📊 Commission par restaurant</h3>
          <p className="m-0 mt-0.5 text-xs text-muted">Pourcentage retenu sur le prix du restaurant (invisible pour le client, utilisé dans le calcul du gain).</p>
          <div className="mt-3 flex flex-wrap items-end gap-2">
            <label className="min-w-[200px] flex-1 text-xs font-bold">
              Restaurant
              <select value={commResto} onChange={(e) => setCommResto(e.target.value)} className={inp}>
                <option value="">Choisir un restaurant…</option>
                {restos.map((r) => (
                  <option key={r.slug} value={r.slug}>{r.nom}</option>
                ))}
              </select>
            </label>
            <label className="w-28 text-xs font-bold">
              Commission (%)
              <input type="number" min="0" max="50" step="1" value={commPct} onChange={(e) => setCommPct(e.target.value)} className={inp} />
            </label>
            <button
              type="button"
              disabled={!commResto || saving === 'comm'}
              onClick={() => {
                const pct = num(commPct, 0);
                const next = { ...commissionsRestos };
                if (pct > 0) next[commResto] = pct;
                else delete next[commResto];
                enregistrer('comm', { commission: Object.keys(next).length ? { restos: next } : {} }, 'Commission restaurant');
                setCommResto('');
              }}
              className="h-10 rounded-xl bg-primary px-4 text-xs font-extrabold text-white disabled:opacity-40"
            >
              Enregistrer %
            </button>
          </div>
          {Object.keys(commissionsRestos).length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {Object.entries(commissionsRestos).map(([slug, pct]) => (
                <span key={slug} className="inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1.5 text-xs font-extrabold text-amber-900">
                  {slug} : {pct}%
                  <button
                    type="button"
                    onClick={() => {
                      const next = { ...commissionsRestos };
                      delete next[slug];
                      enregistrer('comm', { commission: Object.keys(next).length ? { restos: next } : {} }, 'Commission retirée');
                    }}
                    className="text-red-700"
                  >
                    ✕
                  </button>
                </span>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
