// Les navigateurs intégrés Android (Messenger, Facebook, Instagram…) refusent la géolocalisation
// sans même demander : on propose de rouvrir la page dans Chrome. Sur iPhone, ils l'autorisent.
const INTEGRE = /FBAN|FBAV|FB_IAB|Instagram|Messenger|Line\/|Snapchat|TikTok|musical_ly|; wv\)/i;

export function navigateurIntegreAndroid(ua: string): boolean {
  return /Android/i.test(ua) && INTEGRE.test(ua);
}

/** Lien intent qui rouvre l'URL dans Chrome (ou la même URL si Chrome est absent). */
export function lienChrome(url: string): string {
  const u = new URL(url);
  return `intent://${u.host}${u.pathname}${u.search}#Intent;scheme=${u.protocol.replace(':', '')};package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(url)};end`;
}

/** Navigateurs intégrés iPhone (Instagram, Facebook, TikTok…) : ils ne savent pas installer l'app, il faut Safari. */
export function navigateurIntegreIOS(ua: string): boolean {
  return /iPhone|iPad|iPod/i.test(ua) && /FBAN|FBAV|Instagram|Messenger|Line\/|Snapchat|TikTok|musical_ly/i.test(ua);
}

/** Bandeau fermé avec ✕ : on ne le remontre qu'après `jours` jours. `ferme` = date de fermeture (ms) ou null. */
export function rappelEchu(ferme: number | null, maintenant: number, jours = 3): boolean {
  return ferme === null || !(maintenant - ferme < jours * 86_400_000);
}

/**
 * Téléphone / tablette : on propose le GPS. Sur PC, la géolocalisation vient de l'IP (souvent fausse) :
 * on ne propose que la recherche d'adresse. iPadOS se présente comme un Mac → on regarde aussi l'écran tactile.
 */
export function estMobile(ua: string, ecranTactile: boolean): boolean {
  return /Android|iPhone|iPod|Mobile|Mobi/i.test(ua) || (ecranTactile && /Macintosh|iPad/i.test(ua));
}

/** iPhone / iPad (iPadOS se présente comme un Mac tactile) : instructions Safari pour la localisation. */
export function estIOS(ua: string, ecranTactile: boolean): boolean {
  return /iPhone|iPad|iPod/i.test(ua) || (ecranTactile && /Macintosh/i.test(ua));
}
