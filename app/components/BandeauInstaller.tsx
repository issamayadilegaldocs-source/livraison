'use client';

import { useEffect, useState } from 'react';
import { useT } from '@/lib/i18n';
import { estIOS, lienChrome, navigateurIntegreAndroid, navigateurIntegreIOS, rappelEchu } from '@/lib/navigateur';

const CLE_FERME = 'installer-ferme';

type Invite = Event & { prompt: () => Promise<void> };

/**
 * Bandeau « Installer l'app », affiché à chaque visite tant que l'app n'est pas installée.
 * Android/Chrome : un clic ouvre la fenêtre d'installation du navigateur (beforeinstallprompt) — la confirmation
 * du navigateur est obligatoire, aucun site ne peut installer sans elle. Sans cet événement (iPhone, autres navigateurs) :
 * le clic affiche les étapes à suivre.
 */
export default function BandeauInstaller({ nom }: { nom: string }) {
  const t = useT();
  const [invite, setInvite] = useState<Invite | null>(null);
  const [visible, setVisible] = useState(false);
  const [aide, setAide] = useState(false);
  const [ios, setIos] = useState(false);
  const [integre, setIntegre] = useState(false); // navigateur intégré (Instagram, Facebook…) : installation impossible
  const [versChrome, setVersChrome] = useState('');

  useEffect(() => {
    const installee = () => window.matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone;
    if (installee()) return; // déjà ouverte comme une appli : rien à faire
    try {
      if (!rappelEchu(Number(localStorage.getItem(CLE_FERME) ?? NaN) || null, Date.now())) return; // fermé il y a peu
    } catch {}
    const ua = navigator.userAgent;
    setIos(estIOS(ua, navigator.maxTouchPoints > 1));
    if (navigateurIntegreAndroid(ua)) setVersChrome(lienChrome(location.href.split('#')[0]));
    setIntegre(navigateurIntegreIOS(ua) || navigateurIntegreAndroid(ua));
    setVisible(true);
    const avant = (e: Event) => {
      e.preventDefault();
      setInvite(e as Invite);
    };
    const fini = () => setVisible(false);
    window.addEventListener('beforeinstallprompt', avant);
    window.addEventListener('appinstalled', fini);
    return () => {
      window.removeEventListener('beforeinstallprompt', avant);
      window.removeEventListener('appinstalled', fini);
    };
  }, []);

  if (!visible) return null;

  const fermer = () => {
    setVisible(false);
    try {
      localStorage.setItem(CLE_FERME, String(Date.now()));
    } catch {}
  };

  const installer = async () => {
    if (!invite && ios && !integre && navigator.share) {
      // iPhone : aucune installation par code, mais on ouvre la feuille Partager directement (il reste « Sur l'écran d'accueil »)
      setAide(true);
      return navigator.share({ title: nom, url: location.href }).catch(() => {});
    }
    if (!invite) return setAide((a) => !a);
    await invite.prompt();
    setInvite(null); // l'événement ne sert qu'une fois ; si refusé, le bandeau reste (et réapparaît à la prochaine visite)
  };

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 pl-[max(0.75rem,env(safe-area-inset-left))] pr-[max(0.75rem,env(safe-area-inset-right))] pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      <div className="mx-auto max-w-md rounded-2xl bg-ink p-3 text-sm text-white shadow-lg">
        <div className="flex items-center gap-3">
          <p className="min-w-0 flex-1 font-semibold">{t('Installer {nom} sur ton téléphone', { nom })}</p>
          {versChrome ? (
            <a href={versChrome} className="grid h-11 shrink-0 place-items-center rounded-full bg-primary px-5 font-bold">
              {t('Ouvrir dans Chrome')}
            </a>
          ) : (
            <button onClick={installer} className="h-11 shrink-0 rounded-full bg-primary px-5 font-bold">
              {t('Installer')}
            </button>
          )}
          <button onClick={fermer} aria-label={t('Fermer')} className="grid h-11 w-11 shrink-0 place-items-center text-lg">
            ✕
          </button>
        </div>
        {(aide || (integre && !versChrome)) && (
          <div className="mt-2 border-t border-white/20 pt-2 leading-snug">
            {integre ? (
              <p>{t('Cette page est ouverte dans une appli (Instagram, Facebook…). Ouvre-la dans Safari ou Chrome, puis installe.')}</p>
            ) : ios ? (
              <ol className="space-y-1.5">
                <li className="flex items-center gap-2">
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-white/15">
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M12 15V3M8 7l4-4 4 4M5 12v8h14v-8" />
                    </svg>
                  </span>
                  {t('1. Touche Partager, en bas de Safari.')}
                </li>
                <li className="flex items-center gap-2">
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-white/15 text-base font-bold">+</span>
                  {t('2. Choisis « Sur l’écran d’accueil ».')}
                </li>
              </ol>
            ) : (
              <p>{t('Dans Chrome : touche le menu ⋮, puis Installer l’application (ou Ajouter à l’écran d’accueil).')}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
