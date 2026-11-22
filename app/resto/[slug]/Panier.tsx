'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import dynamic from 'next/dynamic';
import { envoyerBon } from '@/lib/bon-canvas';
import { CLE_CLIENT, lireClient, type ClientMemorise } from '@/lib/client';
import { useT } from '@/lib/i18n';
import { afficherTel, formaterPrix, normaliserTelephone } from '@/lib/commande';
import { useRetour } from '@/lib/retour';
import { meilleurePromo, promosAppliquees, type PromoVue } from '@/lib/commission';
import { calculerFraisService, type FraisService } from '@/lib/frais-service';
import { livraisonOfferte, type LivraisonGratuite } from '@/lib/livraison-gratuite';
import { supplementEnCours, type Supplement } from '@/lib/regles-livreur';
import { calculerLivraison, departCarte, positionPrecise, type ConfLivraison, type Point } from '@/lib/livraison';
import { estIOS, estMobile, lienChrome, navigateurIntegreAndroid } from '@/lib/navigateur';
import { erreurAdresse, erreurNom, erreurTelephone } from '@/lib/validation';
import { prixUnitaire, resumeChoix, type Choix } from '@/lib/options';
import type { PlatVue } from './Menu';

// Leaflet touche à `window` : chargé uniquement dans le navigateur.
const ChoixAdresse = dynamic(() => import('./ChoixAdresse'), { ssr: false });
const MiniCarte = dynamic(() => import('./MiniCarte'), { ssr: false });

export type LignePanier = { cle: string; platId: number; choix: Choix; qte: number };

type Props = {
  slug: string;
  nomResto: string;
  ouvert: boolean;
  messageFerme?: string | null;
  libelle: string;
  plats: PlatVue[];
  lignes: LignePanier[];
  livraison: ConfLivraison;
  fraisService: FraisService | null;
  livraisonGratuite: LivraisonGratuite | null;
  regles: ReglesClient;
  promos: PromoVue[];
  restoPosition: Point;
  sousTotal: number;
  changerQte: (cle: string, delta: number) => void;
  vider: () => void;
};

const champ =
  'mt-1 w-full rounded-xl border border-black/10 bg-white px-3 py-3 text-base outline-none focus:border-primary focus:ring-2 focus:ring-primary/25';
const champErreur = 'mt-1 w-full rounded-xl border-2 border-red-500 bg-red-50/40 px-3 py-3 text-base outline-none focus:ring-2 focus:ring-red-300';
const BROUILLON = (slug: string) => `brouillon-commande:${slug}`;
const DERNIERE = (slug: string) => `derniere-commande:${slug}`; // lignes de la dernière commande envoyée (« Refaire »)

type Resultat = { ref: string; total: number; texteWhatsApp: string; numeroWhatsApp: string; email: string; prenom: string; resto: string };
const km = (n: number) => `${String(n).replace('.', ',')} km`;

/**
 * Commande en 3 temps : panier (dans la page) → vos informations → récapitulatif « Vous êtes sûr ? ».
 * Les deux dernières étapes s'ouvrent en plein écran (pensé téléphone d'abord).
 */
/** Petites règles du livreur vues par le client : commande minimum, supplément, montants de pourboire. */
export type ReglesClient = { commandeMin: number | null; supplement: Supplement | null; pourboires: number[] };

export default function Panier({ slug, nomResto, ouvert, libelle, messageFerme, plats, lignes, livraison, fraisService, livraisonGratuite, regles, promos, restoPosition, sousTotal, changerQte, vider }: Props) {
  const t = useT();
  // 'panier' : le panier en plein écran, ouvert par la barre du bas sur téléphone (sinon il est tout en bas du menu).
  const [etape, setEtape] = useState<null | 'panier' | 'infos' | 'recap' | 'envoyee'>(null);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState('');
  const [resultat, setResultat] = useState<Resultat | null>(null);
  // Coordonnées du client
  const [nom, setNom] = useState('');
  const [tel, setTel] = useState('');
  const [email, setEmail] = useState('');
  const [adresse, setAdresse] = useState('');
  const [note, setNote] = useState('');
  const [pourboire, setPourboire] = useState(0); // DT, pour le livreur
  const [codeSaisi, setCodeSaisi] = useState('');
  const [coupon, setCoupon] = useState<PromoVue | null>(null); // code accepté par le serveur
  const [msgCode, setMsgCode] = useState('');
  // Position acceptée uniquement : GPS précis (≤ 150 m) ou adresse validée sur la carte plein écran.
  const [position, setPosition] = useState<(Point & { label: string; precision?: number }) | null>(null);
  const [locEtat, setLocEtat] = useState<'' | 'recherche' | 'approx' | 'refus' | 'indispo'>('');
  const [choix, setChoix] = useState<Point | null>(null); // carte plein écran ouverte, centrée ici
  const [gpsPrecision, setGpsPrecision] = useState<number | null>(null); // précision en cours pendant la recherche GPS
  const [approx, setApprox] = useState<number | null>(null); // précision du meilleur point quand il a fallu ouvrir la carte
  const [repereOk, setRepereOk] = useState(false); // case « le repère est sur ma porte » du récapitulatif
  const [ouvrirChrome, setOuvrirChrome] = useState<string | null>(null);
  const [mobile, setMobile] = useState(false); // GPS proposé seulement sur téléphone / tablette
  const [ios, setIos] = useState(false);
  const [touche, setTouche] = useState({ nom: false, tel: false, email: false, adresse: false }); // erreurs affichées après sortie du champ
  const [aideGps, setAideGps] = useState(false); // fenêtre d'aide quand la localisation est refusée
  const [relancerGps, setRelancerGps] = useState(false);

  useEffect(() => {
    setMobile(estMobile(navigator.userAgent, navigator.maxTouchPoints > 1));
    setIos(estIOS(navigator.userAgent, navigator.maxTouchPoints > 1));
    if (navigateurIntegreAndroid(navigator.userAgent)) setOuvrirChrome(lienChrome(location.href.split('#')[0]));
    // Retour après « Recharger et réessayer » : on restaure le formulaire et on relance le GPS.
    try {
      const b = JSON.parse(sessionStorage.getItem(BROUILLON(slug)) ?? 'null');
      if (b) {
        sessionStorage.removeItem(BROUILLON(slug));
        setNom(b.nom ?? '');
        setTel(b.tel ?? '');
        setEmail(b.email ?? '');
        setAdresse(b.adresse ?? '');
        setNote(b.note ?? '');
        setEtape('infos');
        if (b.relancerGps) setRelancerGps(true);
        return;
      }
    } catch {
      /* stockage indisponible : formulaire vide */
    }
    // Client déjà venu : on préremplit avec sa dernière commande (le repère reste à reconfirmer au récapitulatif).
    try {
      const c = lireClient(localStorage.getItem(CLE_CLIENT));
      if (c) {
        setNom(c.nom);
        setTel(c.tel);
        setEmail(c.email ?? '');
        setAdresse(c.adresse);
        setPosition(c.position);
      }
    } catch {
      /* stockage indisponible */
    }
  }, [slug]);

  // Retour du téléphone : remonte d'une étape, sans quitter la page.
  useRetour(etape !== null, () => {
    if (etape === 'recap') {
      setEtape('infos');
      return true;
    }
    setEtape(null);
    return false;
  });
  useRetour(aideGps, () => {
    setAideGps(false);
    return false;
  });

  // Barre « Voir le panier » masquée quand le panier est déjà à l'écran (sinon deux boutons bleus empilés).
  const [panierVisible, setPanierVisible] = useState(false);
  useEffect(() => {
    const el = document.getElementById('panier');
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => setPanierVisible(e.isIntersecting), { threshold: 0 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (relancerGps && mobile) {
      setRelancerGps(false);
      localiser();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [relancerGps, mobile]);

  function rechargerEtReessayer() {
    try {
      sessionStorage.setItem(BROUILLON(slug), JSON.stringify({ nom, tel, email, adresse, note, relancerGps: true }));
    } catch {
      /* sans stockage, le client ressaisira */
    }
    location.reload();
  }

  // Dès l'étape « Vos informations » : si la localisation est déjà bloquée pour le site, on prévient tout de suite.
  useEffect(() => {
    if (etape !== 'infos' || !mobile || position || !navigator.permissions) return;
    navigator.permissions
      .query({ name: 'geolocation' as PermissionName })
      .then((st) => {
        if (st.state === 'denied') setLocEtat('refus');
      })
      .catch(() => {});
  }, [etape, mobile, position]);

  // Un repère modifié doit être reconfirmé dans le récapitulatif.
  useEffect(() => setRepereOk(false), [position]);

  // Étapes plein écran : bloque le défilement de la page derrière.
  useEffect(() => {
    if (!etape) return;
    const avant = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = avant;
    };
  }, [etape]);

  // Android : le premier point est souvent le réseau (300 m – 2 km). On écoute le GPS jusqu'à 20 s et on garde
  // le meilleur point ; on accepte dès qu'il passe sous 150 m. Sinon la carte s'ouvre centrée sur ce point.
  function localiser() {
    if (!('geolocation' in navigator)) {
      setLocEtat('indispo');
      setChoix(restoPosition);
      return;
    }
    setLocEtat('recherche');
    setGpsPrecision(null);
    let meilleure: (Point & { precision: number }) | null = null;
    let fini = false;
    const terminer = () => {
      if (fini) return;
      fini = true;
      navigator.geolocation.clearWatch(id);
      clearTimeout(minuteur);
      setGpsPrecision(null);
      const { accepter, centre } = departCarte(meilleure, restoPosition);
      if (accepter && meilleure) {
        setPosition({ lat: meilleure.lat, lng: meilleure.lng, label: `Position GPS (± ${meilleure.precision} m)`, precision: meilleure.precision });
        setLocEtat('');
      } else {
        setApprox(meilleure?.precision ?? null);
        setLocEtat(meilleure ? 'approx' : 'indispo');
        setChoix(centre);
      }
    };
    const id = navigator.geolocation.watchPosition(
      (p) => {
        const precision = Math.round(p.coords.accuracy);
        if (!meilleure || precision < meilleure.precision) meilleure = { lat: p.coords.latitude, lng: p.coords.longitude, precision };
        setGpsPrecision(meilleure.precision);
        if (positionPrecise(meilleure.precision)) terminer();
      },
      (e) => {
        if (e.code === e.PERMISSION_DENIED) {
          fini = true;
          navigator.geolocation.clearWatch(id);
          clearTimeout(minuteur);
          setGpsPrecision(null);
          setLocEtat('refus');
          setAideGps(true);
          return;
        }
        // POSITION_UNAVAILABLE / TIMEOUT ponctuels : on continue d'écouter jusqu'au minuteur.
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 },
    );
    const minuteur = setTimeout(terminer, 20000);
  }

  // Aperçu : le serveur refait exactement ce calcul et c'est le sien qui fait foi.
  const estimation = position ? calculerLivraison(livraison, restoPosition, position, t) : null;
  const frais = estimation && 'frais' in estimation ? estimation.frais : null;

  const detail = lignes.flatMap((l) => {
    const p = plats.find((x) => x.id === l.platId);
    return p ? [{ ...l, plat: p, options: resumeChoix(p, l.choix), total: (Math.round(prixUnitaire(p, l.choix) * 1000) * l.qte) / 1000 }] : [];
  });
  const nbArticles = detail.reduce((n, l) => n + l.qte, 0);
  const minManque = regles.commandeMin !== null && sousTotal < regles.commandeMin;
  const parPlatMil: Record<number, number> = {};
  for (const l of detail) parPlatMil[l.platId] = (parPlatMil[l.platId] ?? 0) + Math.round(l.total * 1000);
  // Un code valide passe avant les promos automatiques (comme sur le serveur).
  // Un coupon cumulable s'ajoute à la meilleure promo automatique ; sinon il la remplace (comme sur le serveur).
  const duCoupon = coupon ? meilleurePromo([coupon], slug, Math.round(sousTotal * 1000), parPlatMil) : null;
  const appliquees = promosAppliquees(coupon, promos, slug, Math.round(sousTotal * 1000), parPlatMil);
  const remise = appliquees.reduce((n, a) => n + a.remiseMil, 0) / 1000;
  const offerte = frais !== null && livraisonOfferte(livraisonGratuite, Math.round(sousTotal * 1000));
  // Presque gratuite : combien de plats il manque pour que la livraison soit offerte.
  const resteGratuite = !offerte && livraisonGratuite?.min !== undefined ? livraisonGratuite.min - sousTotal : 0;
  const fraisPayes = offerte ? 0 : (frais ?? 0);
  // Supplément pluie / nuit (heure de Tunis, comme le serveur) : jamais quand la livraison est gratuite.
  const sup = offerte ? null : supplementEnCours(regles.supplement, new Date(), t('Nuit'));
  const supplementPaye = sup?.montant ?? 0;
  const service = calculerFraisService(fraisService, sousTotal - remise);
  const total = (Math.round(sousTotal * 1000) - Math.round(remise * 1000) + Math.round(fraisPayes * 1000) + Math.round(supplementPaye * 1000) + Math.round(service * 1000) + Math.round(pourboire * 1000)) / 1000;
  const telNormalise = normaliserTelephone(tel);

  const errNom = erreurNom(nom, t);
  const errTel = erreurTelephone(tel, t);
  const errAdresse = erreurAdresse(adresse, t);
  const errPosition = !position ? t('Indiquez où livrer : GPS ou carte.') : frais === null ? t('Adresse hors zone de livraison : vérifiez le repère.') : null;
  // Ce qui manque encore (résumé au-dessus du bouton ; le bouton reste cliquable et montre les erreurs).
  const errEmail = email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ? t('Adresse email invalide.') : null;
  const manque = errNom ?? errTel ?? errPosition ?? errAdresse ?? errEmail;

  function verifier() {
    setTouche({ nom: true, tel: true, email: true, adresse: true });
    if (!manque) return setEtape('recap');
    const id = errNom ? 'champ-nom' : errTel ? 'champ-tel' : errEmail ? 'champ-email' : errPosition ? 'bloc-position' : 'champ-adresse';
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  async function envoyer() {
    if (!position || frais === null || envoi || !repereOk) return;
    setEnvoi(true);
    setErreur('');
    try {
      const res = await fetch('/api/commande', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          restoSlug: slug,
          lignes: detail.map((l) => ({ platId: l.platId, qte: l.qte, choix: l.choix })),
          client: { nom: nom.trim(), telephone: tel, adresse: adresse.trim(), note: note.trim() || undefined, email: email.trim() || undefined },
          position: { lat: position.lat, lng: position.lng, precision: position.precision },
          pourboire: pourboire || undefined,
          code: coupon ? codeSaisi.trim().toUpperCase() : undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setErreur(json.erreur ?? t('Une erreur est survenue, réessayez.'));
        return;
      }
      try {
        localStorage.setItem(DERNIERE(slug), JSON.stringify(detail.map((l) => ({ cle: l.cle, platId: l.platId, choix: l.choix, qte: l.qte }))));
      } catch {
        /* sans stockage, pas de « Refaire » */
      }
      vider();
      try {
        const c: ClientMemorise = { nom: nom.trim(), tel, email: email.trim() || undefined, adresse: adresse.trim(), position };
        localStorage.setItem(CLE_CLIENT, JSON.stringify(c));
      } catch {
        /* sans stockage, le client ressaisira la prochaine fois */
      }
      // Bon pour le resto : dessiné ici et envoyé AVANT l'écran WhatsApp (le lien est déjà dans le message),
      // sinon le téléphone peut suspendre l'envoi quand le client part sur WhatsApp. 5 s max : sans bon,
      // la commande reste valable.
      const { bon, ...reponse } = json;
      if (bon) await Promise.race([envoyerBon(bon), new Promise((ok) => setTimeout(ok, 5000))]);
      const r: Resultat = { ...reponse, prenom: nom.trim().split(' ')[0], resto: nomResto };
      setResultat(r);
      setEtape('envoyee');
    } catch {
      setErreur(t('Connexion impossible, vérifiez votre réseau et réessayez.'));
    } finally {
      setEnvoi(false);
    }
  }

  // Contenu du panier, partagé entre le bloc dans la page et le plein écran « Voir le panier ».
  const listePanier = (
    <>
      <ul className="m-0 flex list-none flex-col gap-3 p-0 text-sm">
        {detail.map((l) => (
          <li key={l.cle} className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => changerQte(l.cle, -1)} aria-label={t('Retirer un {nom}', { nom: l.plat.nom })} className="h-11 w-11 rounded-full border border-black/10 text-lg font-bold">
                −
              </button>
              <span className="w-6 text-center font-bold">{l.qte}</span>
              <button type="button" onClick={() => changerQte(l.cle, 1)} aria-label={t('Ajouter un {nom}', { nom: l.plat.nom })} className="h-11 w-11 rounded-full border border-black/10 text-lg font-bold">
                +
              </button>
            </div>
            <div className="min-w-0 flex-1">
              <p className="m-0 font-semibold">{l.plat.nom}</p>
              {l.options && <p className="m-0 text-xs text-muted">{l.options}</p>}
            </div>
            <span className="shrink-0 font-semibold">{formaterPrix(l.total)}</span>
          </li>
        ))}
      </ul>
      <div className="flex justify-between border-t border-black/5 pt-3 text-base font-extrabold">
        <span>{t('Sous-total')}</span>
        <span>{formaterPrix(sousTotal)}</span>
      </div>
      <p className="-mt-2 m-0 text-xs text-muted">{t('Frais de livraison calculés selon votre adresse, à l’étape suivante.')}</p>
      {minManque && regles.commandeMin !== null && (
        <p role="alert" className="m-0 rounded-xl bg-amber-50 p-3 text-sm font-semibold text-amber-900">
          {t('Commande minimum : {m} de plats. Il vous manque {p}.', { m: formaterPrix(regles.commandeMin), p: formaterPrix(regles.commandeMin - sousTotal) })}
        </p>
      )}
      {!ouvert && <p className="m-0 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-800">{messageFerme ?? t('Restaurant fermé · {l}', { l: libelle })}</p>}
    </>
  );
  const boutonCommander = (
    <button
      type="button"
      disabled={!ouvert || minManque}
      onClick={() => setEtape('infos')}
      className="h-12 w-full rounded-full bg-primary px-5 font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
    >
      {t('Passer la commande · {p}', { p: formaterPrix(sousTotal) })}
    </button>
  );
  const panierVide = <p className="m-0 text-sm text-muted">{t('Votre panier est vide. Choisissez un plat pour commencer.')}</p>;

  return (
    // Sticky on desktop: cap the height to the viewport and scroll inside.
    <aside
      id="panier"
      className="scroll-mt-20 lg:sticky lg:top-20 lg:max-h-[calc(100dvh-6rem)] lg:self-start lg:overflow-y-auto lg:overscroll-contain lg:rounded-[24px]"
    >
      {/* Étape 0 : le panier, seul, dans la page */}
      <div className="flex flex-col gap-4 rounded-[24px] bg-white p-5">
        <div className="flex items-baseline justify-between">
          <h2 className="m-0 text-xl font-extrabold">{t('Votre panier')}</h2>
          {nbArticles > 0 && <span className="text-sm font-semibold text-muted">{t(nbArticles > 1 ? '{n} articles' : '{n} article', { n: nbArticles })}</span>}
        </div>
        {detail.length ? (
          <>
            {listePanier}
            {boutonCommander}
          </>
        ) : (
          panierVide
        )}
      </div>

      {nbArticles > 0 && !panierVisible && !etape && (
        <button
          type="button"
          onClick={() => setEtape('panier')}
          className="fixed inset-x-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-30 flex items-center justify-between rounded-full bg-primary px-5 py-3.5 font-bold text-white shadow-lg lg:hidden"
        >
          <span>{t('Voir le panier ({n})', { n: nbArticles })}</span>
          <span>{formaterPrix(sousTotal)}</span>
        </button>
      )}

      {etape === 'panier' && (
        <PleinEcran titre={t('Votre panier')} etape={t(nbArticles > 1 ? '{n} articles' : '{n} article', { n: nbArticles })} onRetour={() => setEtape(null)} retour={t('Menu')}
          pied={detail.length ? boutonCommander : <button type="button" onClick={() => setEtape(null)} className="h-12 w-full rounded-full bg-primary font-bold text-white">{t('Retour au menu')}</button>}
        >
          <section className="flex flex-col gap-4 rounded-[20px] bg-white p-4">{detail.length ? listePanier : panierVide}</section>
        </PleinEcran>
      )}

      {etape === 'infos' && (
        <PleinEcran titre={t('Vos informations')} etape={t('Étape 1/2')} onRetour={() => setEtape(null)} retour={t('Panier')}
          pied={
            <>
              {manque && (touche.nom || touche.tel || touche.adresse) && (
                <p className="m-0 text-center text-xs font-semibold text-red-700">⚠️ {manque}</p>
              )}
              <button type="button" onClick={verifier} className="h-12 w-full rounded-full bg-primary px-5 font-bold text-white">
                {t('Vérifier ma commande')}
              </button>
            </>
          }
        >
          <Section titre={t('Vos coordonnées')} icone="👤">
            <label className="block text-sm font-semibold">
              {t('Nom')}
              <input
                id="champ-nom"
                value={nom}
                onChange={(e) => setNom(e.target.value)}
                onBlur={() => setTouche((t) => ({ ...t, nom: true }))}
                maxLength={80}
                autoComplete="name"
                aria-invalid={touche.nom && !!errNom}
                aria-describedby="err-nom"
                className={touche.nom && errNom ? champErreur : champ}
              />
              {touche.nom && errNom && <span id="err-nom" className="mt-1 block text-xs font-semibold text-red-700">{errNom}</span>}
            </label>
            <label className="block text-sm font-semibold">
              {t('Téléphone')}
              <input
                id="champ-tel"
                value={tel}
                onChange={(e) => setTel(e.target.value)}
                onBlur={() => setTouche((t) => ({ ...t, tel: true }))}
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                aria-invalid={touche.tel && !!errTel}
                aria-describedby="err-tel"
                className={touche.tel && errTel ? champErreur : champ}
              />
              {touche.tel && errTel ? (
                <span id="err-tel" className="mt-1 block text-xs font-semibold text-red-700">{errTel}</span>
              ) : (
                telNormalise && <span className="mt-1 block text-xs font-semibold text-green-700">✓ {afficherTel(telNormalise)}</span>
              )}
            </label>
            <label className="block text-sm font-semibold">
              {t('Email (optionnel)')}
              <input
                id="champ-email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onBlur={() => setTouche((t) => ({ ...t, email: true }))}
                type="email"
                inputMode="email"
                autoComplete="email"
                maxLength={120}
                aria-invalid={!!touche.email && !!errEmail}
                className={touche.email && errEmail ? champErreur : champ}
              />
              {touche.email && errEmail ? (
                <span className="mt-1 block text-xs font-semibold text-red-700">{errEmail}</span>
              ) : (
                <span className="mt-1 block text-xs font-normal text-muted">{t('Pour recevoir le détail de la commande et le montant à payer.')}</span>
              )}
            </label>
          </Section>

          <Section titre={t('Où livrer ?')} icone="📍" id="bloc-position">
            <p className="m-0 rounded-xl bg-cream p-3 text-xs font-semibold text-ink">
              {t('Important : le livreur utilise ce point pour vous trouver. Placez-le exactement sur votre porte, puis précisez l’adresse en dessous.')}
            </p>
            {mobile && ouvrirChrome && (
              <a href={ouvrirChrome} className="rounded-xl bg-amber-50 p-3 text-xs font-semibold text-amber-900">
                {t('Le GPS ne marche pas dans Messenger / Facebook / Instagram.')}{' '}
                <span className="underline">{t('Ouvrir dans Chrome pour utiliser le GPS')}</span>{t(', ou cherchez votre adresse sur la carte.')}
              </a>
            )}
            {position ? (
              <div className="flex items-center gap-3 rounded-xl border border-green-600 bg-green-50 p-3">
                <span aria-hidden className="text-lg text-green-700">✓</span>
                <span className="min-w-0 flex-1 text-sm font-semibold text-green-900">{position.label || t('Adresse choisie sur la carte')}</span>
                <button type="button" onClick={() => setChoix(position)} className="shrink-0 text-sm font-bold text-primary underline">
                  {t('Modifier')}
                </button>
              </div>
            ) : (
              <>
                {mobile && (
                  <button type="button" onClick={localiser} disabled={locEtat === 'recherche'} className="h-12 rounded-xl bg-primary px-3 text-sm font-bold text-white disabled:opacity-80">
                    {locEtat === 'recherche' ? (gpsPrecision ? t('Recherche GPS… ± {m} m', { m: gpsPrecision }) : t('Recherche GPS…')) : t('📍 Utiliser ma position GPS')}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setChoix(restoPosition)}
                  className={mobile ? 'h-11 rounded-xl border border-black/10 px-3 text-sm font-semibold' : 'h-12 rounded-xl bg-primary px-3 text-sm font-bold text-white'}
                >
                  {t('🔎 Chercher mon adresse sur la carte')}
                </button>
              </>
            )}
            {!position && locEtat === 'approx' && (
              <Alerte niveau="attention" titre={approx ? t('GPS imprécis (± {m} m)', { m: approx }) : t('GPS imprécis')}>
                {t('Placez le repère sur votre porte sur la carte. Astuce : activez la « Localisation précise » du téléphone et réessayez près d’une fenêtre.')}
              </Alerte>
            )}
            {!position && locEtat === 'refus' && (
              <Alerte niveau="erreur" titre={t('Localisation refusée')}>
                {t('Touchez « Utiliser ma position GPS » pour voir comment l’autoriser, ou cherchez votre adresse sur la carte.')}
              </Alerte>
            )}
            {touche.adresse && !position && <p className="m-0 text-xs font-semibold text-red-700">{errPosition}</p>}
            {!position && locEtat === 'indispo' && (
              <Alerte niveau="erreur" titre={t('GPS introuvable')}>
                {t('Activez la localisation du téléphone (menu rapide en haut de l’écran), puis réessayez. Sinon, cherchez votre adresse sur la carte.')}
              </Alerte>
            )}
            {estimation && 'erreur' in estimation && (
              <Alerte niveau="erreur" titre={t('Adresse hors zone')}>
                {estimation.erreur} {t('Vérifiez le repère.')}
              </Alerte>
            )}
            {estimation && 'frais' in estimation && (
              <p className="m-0 text-sm text-muted">
                {t('Livraison :')} <strong className="text-ink">{formaterPrix(estimation.frais)}</strong> ({km(estimation.km)})
              </p>
            )}
            <label className="block text-sm font-semibold">
              {t('Adresse précise')}
              <textarea
                id="champ-adresse"
                value={adresse}
                onChange={(e) => setAdresse(e.target.value)}
                onBlur={() => setTouche((t) => ({ ...t, adresse: true }))}
                maxLength={300}
                rows={2}
                autoComplete="street-address"
                aria-invalid={touche.adresse && !!errAdresse}
                className={touche.adresse && errAdresse ? champErreur : champ}
              />
              {touche.adresse && errAdresse ? (
                <span className="mt-1 block text-xs font-semibold text-red-700">{errAdresse}</span>
              ) : (
                <span className="mt-1 block text-xs font-normal text-muted">{t('Rue et n°, immeuble, étage, et un repère (ex. en face de la pharmacie).')}</span>
              )}
            </label>
            <label className="block text-sm font-semibold">
              {t('Note pour le livreur (optionnel)')}
              <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} placeholder={t('Code, sans oignons…')} className={champ} />
            </label>
          </Section>
        </PleinEcran>
      )}

      {etape === 'recap' && position && frais !== null && (
        <PleinEcran titre={t('Vous êtes sûr ?')} etape={t('Étape 2/2')} onRetour={() => setEtape('infos')} onFermer={() => setEtape(null)} retour={t('Modifier')}
          pied={
            <>
              {erreur && (
                <p role="alert" className="m-0 rounded-xl bg-red-50 p-3 text-sm text-red-800">
                  {erreur}
                </p>
              )}
              <button type="button" onClick={envoyer} disabled={envoi || !repereOk} className="h-12 w-full rounded-full bg-primary px-5 font-bold text-white disabled:opacity-50">
                {envoi ? t('Validation…') : !repereOk ? t('Confirmez le repère sur la carte') : t('Confirmer la commande · {p}', { p: formaterPrix(total) })}
              </button>
              <button type="button" onClick={() => setEtape('infos')} disabled={envoi} className="h-11 w-full rounded-full border border-black/10 text-sm font-bold">
                {t('Modifier ma commande')}
              </button>
            </>
          }
        >
          <Section titre={nomResto} icone="🏪">
            <ul className="flex flex-col gap-2 text-sm">
              {detail.map((l) => (
                <li key={l.cle} className="flex items-start gap-3">
                  <span className="shrink-0 rounded-md bg-primary px-1.5 font-bold text-white">{l.qte}×</span>
                  <div className="min-w-0 flex-1">
                    <p className="m-0 font-semibold">{l.plat.nom}</p>
                    {l.options && <p className="m-0 text-xs text-muted">+ {l.options}</p>}
                  </div>
                  <span className="shrink-0 font-semibold">{formaterPrix(l.total)}</span>
                </li>
              ))}
            </ul>
          </Section>

          <Section titre={t('Code promo (optionnel)')} icone="🏷️">
            {coupon ? (
              <div className="flex items-center justify-between gap-3 rounded-xl bg-[#fde7ef] p-3 text-sm font-bold text-[#b0124d]">
                <span>{duCoupon ? `✅ ${t('Coupon {c} appliqué', { c: codeSaisi.trim().toUpperCase() })}` : `⚠️ ${t('Ce code demande un panier plus grand ou d’autres plats.')}`}</span>
                <button type="button" onClick={() => { setCoupon(null); setCodeSaisi(''); setMsgCode(''); }} className="min-h-11 shrink-0 rounded-full bg-white px-4 text-sm font-bold text-ink">{t('Retirer')}</button>
              </div>
            ) : (
              <div className="flex gap-2">
                <input value={codeSaisi} onChange={(e) => { setCodeSaisi(e.target.value.toUpperCase()); setMsgCode(''); }} maxLength={20} autoCapitalize="characters" autoComplete="off" placeholder={t('Votre code')} className={champ} />
                <button
                  type="button"
                  disabled={codeSaisi.trim().length < 3}
                  onClick={async () => {
                    setMsgCode('');
                    try {
                      const res = await fetch('/api/coupon', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: codeSaisi.trim(), resto: slug }) });
                      const j = await res.json();
                      if (res.ok) setCoupon(j.promo as PromoVue);
                      else setMsgCode(j.erreur ?? t('Ce code n’existe pas.'));
                    } catch {
                      setMsgCode(t('Impossible de vérifier le code : réessayez.'));
                    }
                  }}
                  className="min-h-12 shrink-0 rounded-xl bg-ink px-4 text-sm font-bold text-white disabled:opacity-40"
                >
                  {t('Appliquer')}
                </button>
              </div>
            )}
            {msgCode && <p className="m-0 text-sm font-semibold text-red-700">{msgCode}</p>}
          </Section>

          <Section titre={t('Pourboire pour le livreur (optionnel)')} icone="🙏">
            <div className="flex flex-wrap gap-2">
              {[0, ...regles.pourboires].map((v) => (
                <button
                  key={v}
                  type="button"
                  aria-pressed={pourboire === v}
                  onClick={() => setPourboire(v)}
                  className={`min-h-11 rounded-full border px-4 text-sm font-bold ${pourboire === v ? 'border-primary bg-primary text-white' : 'border-black/10 bg-white text-ink'}`}
                >
                  {v === 0 ? t('Aucun') : formaterPrix(v)}
                </button>
              ))}
            </div>
          </Section>

          <Section titre={t('Paiement à la livraison')} icone="💵">
            <div className="flex flex-col gap-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted">{t('Sous-total')}</span>
                <span>{formaterPrix(sousTotal)}</span>
              </div>
              {appliquees.map((a) => (
                <div key={a.promo.id} className="flex justify-between font-semibold text-green-700">
                  <span>{coupon && a.promo.id === coupon.id ? t('Coupon {c}', { c: codeSaisi.trim().toUpperCase() }) : a.promo.nom}</span>
                  <span>−{formaterPrix(a.remiseMil / 1000)}</span>
                </div>
              ))}
              <div className="flex justify-between">
                <span className="text-muted">{t('Livraison')} ({estimation && 'km' in estimation ? km(estimation.km) : ''})</span>
                <span>{offerte ? <><s className="text-muted">{formaterPrix(frais)}</s> <b className="text-green-700">{t('Offerte')} 🎉</b></> : formaterPrix(frais)}</span>
              </div>
              {resteGratuite > 0 && <p className="m-0 text-xs font-semibold text-green-700">🎁 {t('Plus que {p} de plats pour la livraison gratuite.', { p: formaterPrix(resteGratuite) })}</p>}
              {sup && (
                <div className="flex justify-between">
                  <span className="text-muted">{t('Supplément')} {sup.libelle}</span>
                  <span>{formaterPrix(sup.montant)}</span>
                </div>
              )}
              {service > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted">{t('Frais de service')}</span>
                  <span>{formaterPrix(service)}</span>
                </div>
              )}
              {pourboire > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted">{t('Pourboire')}</span>
                  <span>{formaterPrix(pourboire)}</span>
                </div>
              )}
              <div className="mt-1 flex justify-between border-t border-black/5 pt-2 text-lg font-extrabold">
                <span>{t('Total')}</span>
                <span className="text-primary">{formaterPrix(total)}</span>
              </div>
            </div>
          </Section>

          <Section titre={t('Le livreur viendra ici')} icone="📍">
            <MiniCarte point={position} />
            <label className={`flex items-start gap-3 rounded-xl border p-3 text-sm font-semibold ${repereOk ? 'border-green-600 bg-green-50 text-green-900' : 'border-amber-400 bg-amber-50 text-amber-900'}`}>
              <input type="checkbox" checked={repereOk} onChange={(e) => setRepereOk(e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--couleur)]" />
              {t('Je confirme que le repère est bien sur ma porte.')}
            </label>
            <button type="button" onClick={() => setChoix(position)} className="h-11 rounded-xl border border-black/10 text-sm font-bold">
              {t('Corriger le repère')}
            </button>
          </Section>

          <Section titre={t('Livraison')} icone="🛵">
            <div className="flex flex-col gap-1 text-sm">
              <p className="m-0 font-semibold">{nom.trim()}</p>
              <p className="m-0">📞 {telNormalise ? afficherTel(telNormalise) : tel}</p>
              <p className="m-0">🏠 {adresse.trim()}</p>
              {position.label && position.label !== adresse.trim() && <p className="m-0 text-xs text-muted">📍 {position.label}</p>}
              {note.trim() && <p className="m-0">📝 {note.trim()}</p>}
            </div>
          </Section>
        </PleinEcran>
      )}

      {etape === 'envoyee' && resultat && (
        <PleinEcran titre={t('Commande envoyée')} onRetour={() => setEtape(null)} retour={t('Fermer')}
          pied={
            <button type="button" onClick={() => setEtape(null)} className="h-12 w-full rounded-full bg-primary font-bold text-white">
              {t('Retour au menu')}
            </button>
          }
        >
          <div role="status" className="flex flex-col items-center gap-2 py-8 text-center">
            <p className="m-0 text-5xl" aria-hidden>
              ✅
            </p>
            <h3 className="m-0 text-2xl font-extrabold">{t('Merci {prenom} !', { prenom: resultat.prenom })}</h3>
            <p className="m-0 text-sm text-muted">{t('Commande N° {ref} envoyée. Le livreur va vous appeler pour confirmer.', { ref: resultat.ref })}</p>
            <p className="m-0 mt-2 text-lg font-bold">{t('À payer à la livraison : {p}', { p: formaterPrix(resultat.total) })}</p>
          </div>
        </PleinEcran>
      )}

      {aideGps && (
        <AideLocalisation
          ios={ios}
          onReessayer={() => {
            setAideGps(false);
            localiser();
          }}
          onRecharger={rechargerEtReessayer}
          onCarte={() => {
            setAideGps(false);
            setChoix(restoPosition);
          }}
          onFermer={() => setAideGps(false)}
        />
      )}
      {choix && (
        <ChoixAdresse
          depart={choix}
          zone={restoPosition}
          gps={mobile}
          centrerSurMoi={!position}
          ajuster={!position}
          onFermer={() => setChoix(null)}
          onValider={({ point, label }) => {
            setPosition({ ...point, label });
            if (label && !adresse.trim()) setAdresse(label);
            setLocEtat('');
            setChoix(null);
          }}
        />
      )}
    </aside>
  );
}

function PleinEcran({ titre, etape, retour, onRetour, onFermer, pied, children }: { titre: string; etape?: string; retour: string; onRetour: () => void; /** Ferme tout (X en haut à droite) ; sinon le X fait comme « retour ». */ onFermer?: () => void; pied: ReactNode; children: ReactNode }) {
  const t = useT();
  return createPortal(
    <div role="dialog" aria-modal="true" aria-label={titre} className="fixed inset-0 z-[900] flex flex-col bg-cream lg:items-center lg:bg-black/40 lg:p-6">
      <div className="flex min-h-0 w-full flex-1 flex-col bg-cream lg:max-w-lg lg:rounded-[24px] lg:shadow-2xl">
        <header className="flex items-center gap-3 border-b border-black/5 bg-white px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] lg:rounded-t-[24px]">
          <button type="button" onClick={onRetour} className="flex h-10 items-center gap-1 rounded-full bg-cream px-3 text-sm font-bold">
            <span aria-hidden className="inline-block rtl:-scale-x-100">←</span> {retour}
          </button>
          <div className="min-w-0 flex-1">
            <p className="m-0 truncate text-lg font-extrabold">{titre}</p>
            {etape && <p className="m-0 text-xs font-semibold text-muted">{etape}</p>}
          </div>
          <button type="button" onClick={onFermer ?? onRetour} aria-label={t('Fermer')} className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-cream text-lg font-bold">
            ✕
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">
          <div className="flex flex-col gap-4">{children}</div>
        </div>
        <footer className="flex flex-col gap-2 border-t border-black/5 bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))] lg:rounded-b-[24px]">{pied}</footer>
      </div>
    </div>,
    document.body,
  );
}

function Section({ titre, icone, id, children }: { titre: string; icone: string; id?: string; children: ReactNode }) {
  return (
    <section id={id} className="flex scroll-mt-24 flex-col gap-3 rounded-[20px] bg-white p-4">
      <h3 className="m-0 flex items-center gap-2 text-base font-extrabold">
        <span aria-hidden>{icone}</span>
        {titre}
      </h3>
      {children}
    </section>
  );
}

function Alerte({ niveau, titre, children }: { niveau: 'attention' | 'erreur'; titre: string; children: ReactNode }) {
  const style = niveau === 'erreur' ? 'border-red-300 bg-red-50 text-red-900' : 'border-amber-300 bg-amber-50 text-amber-900';
  return (
    <div role="alert" className={`flex gap-3 rounded-xl border p-3 ${style}`}>
      <span aria-hidden className="text-lg leading-none">⚠️</span>
      <div className="text-xs">
        <p className="m-0 text-sm font-extrabold">{titre}</p>
        <p className="m-0 mt-1">{children}</p>
      </div>
    </div>
  );
}

/** Localisation refusée : étapes pour l'autoriser selon l'appareil, et toujours une issue (réessayer, recharger, carte). */
function AideLocalisation({ ios, onReessayer, onRecharger, onCarte, onFermer }: { ios: boolean; onReessayer: () => void; onRecharger: () => void; onCarte: () => void; onFermer: () => void }) {
  const t = useT();
  const etapes = ios
    ? [
        t('Touchez « aA » (ou ⋯) à gauche de l’adresse du site.'),
        t('Réglages du site web → Position → Autoriser.'),
        t('Si ça ne suffit pas : Réglages de l’iPhone → Confidentialité et sécurité → Service de localisation → activé, et « Sites Safari » → Lorsque l’app est active.'),
      ]
    : [
        t('Touchez le cadenas (ou ⓘ) à gauche de l’adresse du site.'),
        t('Autorisations → Position → Autoriser.'),
        t('Vérifiez aussi que la localisation du téléphone est activée (menu rapide en haut de l’écran).'),
      ];
  return createPortal(
    <div role="dialog" aria-modal="true" aria-label={t('Autoriser la localisation')} className="fixed inset-0 z-[950] flex items-end justify-center bg-black/50 p-3 sm:items-center">
      <div className="w-full max-w-md rounded-[24px] bg-white p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <h3 className="m-0 text-lg font-extrabold">{t('📍 Autoriser la localisation')}</h3>
          <button type="button" onClick={onFermer} aria-label={t('Fermer')} className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-cream">
            ✕
          </button>
        </div>
        <p className="m-0 mt-2 text-sm text-muted">{t('La localisation a été refusée pour ce site. Elle permet au livreur de vous trouver facilement.')}</p>
        <ol className="m-0 mt-3 flex list-decimal flex-col gap-1.5 ps-5 text-sm">
          {etapes.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ol>
        <div className="mt-4 flex flex-col gap-2">
          <button type="button" onClick={onReessayer} className="h-12 rounded-full bg-primary font-bold text-white">
            {t('J’ai autorisé, réessayer')}
          </button>
          <button type="button" onClick={onRecharger} className="h-11 rounded-full border border-black/10 text-sm font-bold">
            {t('Recharger la page et réessayer (vos infos sont gardées)')}
          </button>
          <button type="button" onClick={onCarte} className="h-11 rounded-full text-sm font-bold text-primary underline">
            {t('Plutôt chercher mon adresse sur la carte')}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
