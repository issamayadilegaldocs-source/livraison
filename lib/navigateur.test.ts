import { describe, expect, it } from 'vitest';
import { estIOS, estMobile, lienChrome, navigateurIntegreAndroid, navigateurIntegreIOS, rappelEchu } from './navigateur';

const MESSENGER_ANDROID =
  'Mozilla/5.0 (Linux; Android 13; SM-A135F Build/TP1A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/119.0 Mobile Safari/537.36 [FB_IAB/Orca-Android;FBAV/440.0.0.30.110;]';
const INSTAGRAM_ANDROID =
  'Mozilla/5.0 (Linux; Android 12; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/118.0 Mobile Safari/537.36 Instagram 309.0.0.40.113 Android';
const CHROME_ANDROID = 'Mozilla/5.0 (Linux; Android 13; SM-A135F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0 Mobile Safari/537.36';
const MESSENGER_IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/MessengerForiOS;FBAV/440.0]';

describe('navigateurIntegreAndroid', () => {
  it('détecte Messenger / Facebook et Instagram sur Android', () => {
    expect(navigateurIntegreAndroid(MESSENGER_ANDROID)).toBe(true);
    expect(navigateurIntegreAndroid(INSTAGRAM_ANDROID)).toBe(true);
  });
  it('ignore Chrome Android et l’iPhone (le GPS y fonctionne)', () => {
    expect(navigateurIntegreAndroid(CHROME_ANDROID)).toBe(false);
    expect(navigateurIntegreAndroid(MESSENGER_IPHONE)).toBe(false);
  });
});

describe('lienChrome', () => {
  it('rouvre la même page dans Chrome via un intent Android', () => {
    expect(lienChrome('https://livreur.hamma-delivery.com/resto/baguette-baguette?x=1')).toBe(
      'intent://livreur.hamma-delivery.com/resto/baguette-baguette?x=1#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=https%3A%2F%2Flivreur.hamma-delivery.com%2Fresto%2Fbaguette-baguette%3Fx%3D1;end',
    );
  });
});

describe('estMobile', () => {
  const PC_CHROME = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36';
  const MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15';
  it('PC et Mac à la souris → pas mobile (pas de bouton GPS)', () => {
    expect(estMobile(PC_CHROME, false)).toBe(false);
    expect(estMobile(MAC, false)).toBe(false);
  });
  it('Android, iPhone → mobile', () => {
    expect(estMobile(CHROME_ANDROID, false)).toBe(true);
    expect(estMobile(MESSENGER_IPHONE, false)).toBe(true);
  });
  it('iPad (se présente comme un Mac) avec écran tactile → mobile', () => expect(estMobile(MAC, true)).toBe(true));
});

describe('navigateurIntegreIOS', () => {
  it('Messenger/Instagram iPhone → oui ; Safari iPhone et Android → non', () => {
    expect(navigateurIntegreIOS(MESSENGER_IPHONE)).toBe(true);
    expect(navigateurIntegreIOS('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1')).toBe(false);
    expect(navigateurIntegreIOS(INSTAGRAM_ANDROID)).toBe(false);
  });
});

describe('rappelEchu', () => {
  const J = 86_400_000;
  it('jamais fermé → on affiche ; fermé depuis < 3 j → on cache ; ≥ 3 j → on réaffiche', () => {
    expect(rappelEchu(null, 10 * J)).toBe(true);
    expect(rappelEchu(9 * J, 10 * J)).toBe(false);
    expect(rappelEchu(7 * J, 10 * J)).toBe(true);
  });
  it('valeur corrompue (NaN) → on affiche', () => expect(rappelEchu(NaN, 10 * J)).toBe(true));
});

describe('estIOS', () => {
  it('iPhone et iPad → iOS ; Android → non', () => {
    expect(estIOS(MESSENGER_IPHONE, true)).toBe(true);
    expect(estIOS('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15', true)).toBe(true);
    expect(estIOS(CHROME_ANDROID, true)).toBe(false);
  });
});
