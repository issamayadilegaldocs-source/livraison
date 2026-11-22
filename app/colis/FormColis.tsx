'use client';
// Formulaire « Envoyer un colis » : adresses placées sur la carte, taille, coordonnées, puis POST /api/colis.
// Le livreur reçoit un email et appelle le client ; l'écran de confirmation le dit.
import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import dynamic from 'next/dynamic';
import Link from '@/app/components/Lien';
import { CLE_CLIENT, lireClient } from '@/lib/client';
import { supplementColis, TAILLES, type Taille, type TarifColis } from '@/lib/colis';
import { formaterPrix } from '@/lib/commande';
import { useT } from '@/lib/i18n';
import { calculerLivraison, type Point } from '@/lib/livraison';
import { useMaintenant } from '@/lib/maintenant';
import { estMobile } from '@/lib/navigateur';
import { useReglages } from '@/lib/reglages';
import { messageArret, type Service } from '@/lib/service';
import { erreurTelephone } from '@/lib/validation';

const ChoixAdresse = dynamic(() => import('../resto/[slug]/ChoixAdresse'), { ssr: false });

type Props = { zone: Point; tarif: TarifColis; service?: Service; ville: string; whatsapp: string };
type Lieu = { adresse: string; position: Point | null };
type Envoye = { ref: string; frais: number; km: number; email: string };

const champ = 'h-12 w-full min-w-0 rounded-xl border border-black/15 bg-white px-3 text-base outline-none focus:border-primary';
const etiquette = 'text-[13px] font-bold text-muted';

export default function FormColis({ zone, tarif, service, ville, whatsapp }: Props) {
  const tr = useT();
  const [depart, setDepart] = useState<Lieu>({ adresse: '', position: null });
  const [arrivee, setArrivee] = useState<Lieu>({ adresse: '', position: null });
  const [carte, setCarte] = useState<'depart' | 'arrivee' | null>(null);
  const [taille, setTaille] = useState<Taille>('petit');
  const [contenu, setContenu] = useState('');
  const [nom, setNom] = useState('');
  const [tel, setTel] = useState('');
  const [destNom, setDestNom] = useState('');
  const [destTel, setDestTel] = useState('');
  const [heure, setHeure] = useState(''); // vide = dès que possible
  const [plusTard, setPlusTard] = useState(false);
  const [note, setNote] = useState('');
  const [mobile, setMobile] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState('');
  const [envoye, setEnvoye] = useState<Envoye | null>(null);

  // Client déjà venu (commande ou colis) : nom, téléphone et adresse préremplis comme point de ramassage.
  useEffect(() => {
    setMobile(estMobile(navigator.userAgent, navigator.maxTouchPoints > 1));
    try {
      const c = lireClient(localStorage.getItem(CLE_CLIENT));
      if (c) {
        setNom(c.nom);
        setTel(c.tel);
        if (c.position) setDepart({ adresse: c.adresse, position: { lat: c.position.lat, lng: c.position.lng } });
      }
    } catch {
      /* stockage indisponible : formulaire vide */
    }
  }, []);

  // Pause et horaires du livreur (page de config) ; la Function revérifie.
  const m = useMaintenant();
  const r = useReglages();
  const arret = m ? messageArret(r ? (r.service ?? undefined) : service, r?.pause ?? false, m, r?.retour ?? undefined, tr) : null;
  // Tarif colis du livreur (sa page de config), sinon celui du build : distance + supplément selon la taille.
  const tc = r?.colis ?? tarif;
  const distance = depart.position && arrivee.position ? calculerLivraison(tc.livraison, depart.position, arrivee.position, tr) : null;
  const estimation = distance && 'frais' in distance ? { ...distance, frais: Math.round((distance.frais + supplementColis(tc, taille, plusTard && heure ? heure : undefined, new Date()).total) * 1000) / 1000 } : distance;

  const manque =
    (!depart.position && tr('Placez le point de ramassage sur la carte.')) ||
    (depart.adresse.trim().length < 5 && tr('Précisez l’adresse de ramassage.')) ||
    (!arrivee.position && tr('Placez le point de livraison sur la carte.')) ||
    (arrivee.adresse.trim().length < 5 && tr('Précisez l’adresse de livraison.')) ||
    (contenu.trim().length < 2 && tr('Dites ce que contient le colis.')) ||
    (nom.trim().length < 2 && tr('Indiquez votre nom.')) ||
    erreurTelephone(tel, tr) ||
    (erreurTelephone(destTel) && tr('Numéro du destinataire : 8 chiffres.')) ||
    (plusTard && !heure && tr('Choisissez l’heure de ramassage.')) ||
    (estimation && 'erreur' in estimation && estimation.erreur) ||
    (!tc.actif && tr('Les demandes de colis sont fermées pour le moment.')) ||
    null;

  async function envoyer(e: FormEvent) {
    e.preventDefault();
    if (envoi || arret || !tc.actif) return;
    if (manque) return setErreur(manque);
    setEnvoi(true);
    setErreur('');
    try {
      const res = await fetch('/api/colis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          depart: { adresse: depart.adresse.trim(), position: depart.position },
          arrivee: { adresse: arrivee.adresse.trim(), position: arrivee.position },
          taille,
          contenu: contenu.trim(),
          client: { nom: nom.trim(), telephone: tel },
          destinataire: { nom: destNom.trim() || undefined, telephone: destTel },
          heure: plusTard && heure ? heure : undefined,
          note: note.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) return setErreur(json.erreur ?? tr('Une erreur est survenue, réessayez.'));
      setEnvoye(json);
      window.scrollTo({ top: 0 });
    } catch {
      setErreur(tr('Pas de connexion. Vérifiez internet et réessayez.'));
    } finally {
      setEnvoi(false);
    }
  }

  if (envoye) return <Confirmation envoye={envoye} tel={tel} depart={depart.adresse} arrivee={arrivee.adresse} whatsapp={whatsapp} />;

  return (
    <form onSubmit={envoyer} noValidate className="flex flex-col gap-3.5">
      <h1 className="m-0 text-2xl font-extrabold tracking-tight">{tr('Envoyer un colis')}</h1>
      <p className="-mt-2 m-0 text-sm text-muted">{tr('Ramassé chez vous, livré partout dans {ville}. Le livreur vous appelle pour confirmer.', { ville })}</p>

      {arret && <p className="m-0 rounded-2xl bg-red-50 p-4 text-sm font-semibold text-red-800">{arret}</p>}

      <Bloc>
        <div className="flex gap-3">
          <div aria-hidden className="flex flex-col items-center pt-7">
            <span className="h-3.5 w-3.5 rounded-full border-[3px] border-primary" />
            <span className="my-1 w-0.5 flex-1 bg-[repeating-linear-gradient(to_bottom,#c7d2e4_0_4px,transparent_4px_8px)]" />
            <span className="h-3.5 w-3.5 rounded bg-ink" />
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-3">
            <ChampLieu id="depart" titre={tr('Ramassage')} lieu={depart} onChange={setDepart} onCarte={() => setCarte('depart')} />
            <div className="h-px bg-black/5" />
            <ChampLieu id="arrivee" titre={tr('Livraison')} lieu={arrivee} onChange={setArrivee} onCarte={() => setCarte('arrivee')} />
          </div>
        </div>
      </Bloc>

      <Bloc titre={tr('Taille du colis')}>
        <div role="radiogroup" aria-label={tr('Taille du colis')} className="grid grid-cols-3 gap-2">
          {(Object.keys(TAILLES) as Taille[]).map((t) => {
            const [nomT, detail] = TAILLES[t].split(' (');
            return (
              <label key={t} className={`flex cursor-pointer flex-col items-center gap-1 rounded-2xl border-2 px-1.5 py-3 text-center ${taille === t ? 'border-primary bg-[#eef5fe]' : 'border-black/10 bg-white'}`}>
                <input type="radio" name="taille" checked={taille === t} onChange={() => setTaille(t)} className="sr-only" />
                <span className="text-sm font-extrabold">{tr(nomT)}</span>
                <span className="text-[11px] font-medium text-muted">{tr(detail.replace(')', ''))}</span>
              </label>
            );
          })}
        </div>
        <label htmlFor="contenu" className={etiquette}>
          {tr('Que contient le colis ?')}
        </label>
        <input id="contenu" value={contenu} onChange={(e) => setContenu(e.target.value)} placeholder={tr('Ex. documents, vêtements, clés')} className={champ} />
      </Bloc>

      <Bloc titre={tr('Vos coordonnées')}>
        <div className="grid grid-cols-2 gap-2.5">
          <Champ id="nom" label={tr('Votre nom')} value={nom} onChange={setNom} autoComplete="name" />
          <Champ id="tel" label={tr('Téléphone')} value={tel} onChange={setTel} type="tel" autoComplete="tel" />
        </div>
        <h3 className="m-0 mt-1 text-base font-extrabold">{tr('Destinataire')}</h3>
        <div className="grid grid-cols-2 gap-2.5">
          <Champ id="dnom" label={tr('Nom (facultatif)')} value={destNom} onChange={setDestNom} />
          <Champ id="dtel" label={tr('Téléphone')} value={destTel} onChange={setDestTel} type="tel" placeholder={tr('8 chiffres')} />
        </div>
      </Bloc>

      <Bloc titre={tr('Quand ?')}>
        <div role="radiogroup" aria-label={tr('Quand')} className="grid grid-cols-2 gap-2">
          {[
            { v: false, t: tr('Dès que possible') },
            { v: true, t: tr('Choisir l’heure') },
          ].map((o) => (
            <label key={o.t} className={`flex h-12 cursor-pointer items-center justify-center rounded-full border-2 text-sm font-extrabold ${plusTard === o.v ? 'border-primary bg-[#eef5fe]' : 'border-black/10 bg-white'}`}>
              <input type="radio" name="quand" checked={plusTard === o.v} onChange={() => setPlusTard(o.v)} className="sr-only" />
              {o.t}
            </label>
          ))}
        </div>
        {plusTard && <Champ id="heure" label={tr('Heure de ramassage (aujourd’hui)')} value={heure} onChange={setHeure} type="time" />}
        <Champ id="note" label={tr('Note pour le livreur (facultatif)')} value={note} onChange={setNote} placeholder={tr('Ex. sonner au 2e étage')} />
      </Bloc>

      <section className="flex flex-col gap-3 rounded-[20px] bg-ink p-4 text-white">
        <div className="flex items-center justify-between gap-3">
          <span className="flex flex-col">
            <span className="text-[13px] font-semibold text-white/80">
              {tr('Estimation')}{estimation && 'km' in estimation ? ` · ${String(estimation.km).replace('.', ',')} km` : ''}
            </span>
            <span className="text-[26px] font-extrabold">{estimation && 'frais' in estimation ? formaterPrix(estimation.frais) : '—'}</span>
          </span>
          <span className="max-w-[150px] text-end text-xs font-medium text-white/80">{tr('Prix confirmé par le livreur au téléphone. Paiement en espèces.')}</span>
        </div>
        {erreur && <p role="alert" className="m-0 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-800">{erreur}</p>}
        <button type="submit" disabled={envoi || Boolean(arret)} className="flex h-[52px] items-center justify-center gap-2 rounded-full bg-saffron text-base font-extrabold text-ink disabled:opacity-60">
          {envoi ? tr('Envoi…') : tr('Envoyer la demande')}
        </button>
        <p className="m-0 text-center text-xs font-medium text-white/80">{tr('Le livreur reçoit votre demande par email et vous appelle pour confirmer.')}</p>
      </section>

      {carte && (
        <ChoixAdresse
          depart={(carte === 'depart' ? depart.position : arrivee.position) ?? depart.position ?? zone}
          zone={zone}
          gps={mobile}
          centrerSurMoi={carte === 'depart' && !depart.position}
          onFermer={() => setCarte(null)}
          onValider={({ point, label }) => {
            const maj = (l: Lieu) => ({ position: point, adresse: l.adresse.trim() ? l.adresse : label });
            if (carte === 'depart') setDepart(maj);
            else setArrivee(maj);
            setCarte(null);
          }}
        />
      )}
    </form>
  );
}

function Bloc({ titre, children }: { titre?: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2.5 rounded-[20px] bg-white p-4">
      {titre && <h2 className="m-0 text-base font-extrabold">{titre}</h2>}
      {children}
    </section>
  );
}

function Champ(p: { id: string; label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string; autoComplete?: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={p.id} className={etiquette}>
        {p.label}
      </label>
      <input id={p.id} type={p.type ?? 'text'} value={p.value} onChange={(e) => p.onChange(e.target.value)} placeholder={p.placeholder} autoComplete={p.autoComplete} className={champ} />
    </div>
  );
}

function ChampLieu({ id, titre, lieu, onChange, onCarte }: { id: string; titre: string; lieu: Lieu; onChange: (l: Lieu) => void; onCarte: () => void }) {
  const tr = useT();
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className={etiquette}>
        {titre}
      </label>
      <input id={id} value={lieu.adresse} onChange={(e) => onChange({ ...lieu, adresse: e.target.value })} placeholder={tr('Adresse de {titre}', { titre: titre.toLowerCase() })} className={champ} />
      <button type="button" onClick={onCarte} className={`flex h-10 items-center gap-2 self-start rounded-full px-3.5 text-[13px] font-bold ${lieu.position ? 'bg-green-50 text-green-800' : 'bg-[#e5f1fd] text-[#1556b8]'}`}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 22s7-6.3 7-12a7 7 0 0 0-14 0c0 5.7 7 12 7 12z" />
          <circle cx="12" cy="10" r="2.5" />
        </svg>
        {lieu.position ? tr('Repère placé · modifier') : tr('Placer sur la carte')}
      </button>
    </div>
  );
}

function Confirmation({ envoye, tel, depart, arrivee, whatsapp }: { envoye: Envoye; tel: string; depart: string; arrivee: string; whatsapp: string }) {
  const tr = useT();
  return (
    <div className="flex flex-col gap-4">
      <section className="flex flex-col items-center gap-2.5 rounded-3xl bg-white px-5 py-7 text-center">
        <span className="grid h-[72px] w-[72px] place-items-center rounded-full bg-green-50 text-green-700">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M20 6 9 17l-5-5" />
          </svg>
        </span>
        <span className="text-[13px] font-extrabold tracking-wider text-muted">{tr('COLIS N° {ref}', { ref: envoye.ref })}</span>
        <h1 className="m-0 text-2xl font-extrabold leading-tight">{envoye.email === 'sent' ? tr('Le livreur a reçu votre demande') : tr('Demande enregistrée')}</h1>
        <p className="m-0 text-[15px] font-medium leading-relaxed text-muted">
          {envoye.email === 'sent' ? (
            <>
              {tr('Il vous appelle pour confirmer le prix et l’heure de ramassage :')} <strong className="text-ink" dir="ltr">{tel}</strong>
            </>
          ) : (
            tr('L’email au livreur n’est pas parti : écrivez-lui sur WhatsApp pour qu’il vous rappelle.')
          )}
        </p>
      </section>
      <section className="flex flex-col gap-2 rounded-[20px] bg-white p-4 text-[15px]">
        <p className="m-0">
          <span className="text-xs font-bold text-muted">{tr('Ramassage')} · </span>
          <strong>{depart}</strong>
        </p>
        <p className="m-0">
          <span className="text-xs font-bold text-muted">{tr('Livraison')} · </span>
          <strong>{arrivee}</strong>
        </p>
        <p className="m-0 flex justify-between border-t border-black/5 pt-3 text-sm">
          <span className="font-semibold text-muted">{tr('Prix estimé')} · {String(envoye.km).replace('.', ',')} km</span>
          <strong>≈ {formaterPrix(envoye.frais)}</strong>
        </p>
      </section>
      <a
        href={`https://api.whatsapp.com/send?${new URLSearchParams({ phone: whatsapp, text: `Bonjour, j’ai envoyé une demande de colis N° ${envoye.ref}.` })}`}
        className="flex h-[52px] items-center justify-center rounded-full bg-[#25D366] text-base font-extrabold text-[#0b3d1f]"
      >
        {tr('Écrire au livreur sur WhatsApp')}
      </a>
      <Link href="/" className="flex h-12 items-center justify-center rounded-full border border-black/15 bg-white text-[15px] font-bold text-ink">
        {tr('Retour à l’accueil')}
      </Link>
    </div>
  );
}
