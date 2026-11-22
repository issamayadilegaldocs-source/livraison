import { webcrypto } from 'node:crypto';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { cleVapidPublique, endpointValide, envoyerPush, jwtVapid } from './push';

let jwk: string;
beforeAll(async () => {
  const { privateKey } = await webcrypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign']);
  jwk = JSON.stringify(await webcrypto.subtle.exportKey('jwk', privateKey));
});

const dec = (s: string) => Uint8Array.from(Buffer.from(s, 'base64url'));
const FCM = 'https://fcm.googleapis.com/fcm/send/abc';

describe('endpointValide', () => {
  it('accepte https + service push connu, refuse le reste (pas d’appel vers un serveur libre)', () => {
    expect(endpointValide(FCM)).toBe(true);
    expect(endpointValide('https://updates.push.services.mozilla.com/wpush/v2/x')).toBe(true);
    expect(endpointValide('https://web.push.apple.com/x')).toBe(true);
    expect(endpointValide('http://fcm.googleapis.com/x')).toBe(false);
    expect(endpointValide('https://evil.com/x')).toBe(false);
    expect(endpointValide('https://fcm.googleapis.com.evil.com/x')).toBe(false);
    expect(endpointValide(42)).toBe(false);
  });
});

describe('VAPID', () => {
  it('la clé publique est un point P-256 non compressé de 65 octets', () => {
    const pub = dec(cleVapidPublique(jwk));
    expect(pub.length).toBe(65);
    expect(pub[0]).toBe(4);
  });

  it('le JWT ES256 est signé par la clé privée, vise l’origine du service et expire sous 24 h', async () => {
    const jwt = await jwtVapid(FCM, jwk, 'https://ahmed.test', 1000);
    const [h, c, sig] = jwt.split('.');
    expect(JSON.parse(Buffer.from(h, 'base64url').toString())).toEqual({ typ: 'JWT', alg: 'ES256' });
    expect(JSON.parse(Buffer.from(c, 'base64url').toString())).toEqual({ aud: 'https://fcm.googleapis.com', exp: 1000 + 12 * 3600, sub: 'https://ahmed.test' });
    const pub = await webcrypto.subtle.importKey('raw', dec(cleVapidPublique(jwk)), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
    expect(await webcrypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, pub, dec(sig), new TextEncoder().encode(`${h}.${c}`))).toBe(true);
    expect(dec(sig).length).toBe(64);
  });
});

describe('envoyerPush', () => {
  it('envoie une requête vide en urgence haute à chaque appareil et rend les adresses mortes (404/410)', async () => {
    const vivant = FCM;
    const mort = 'https://fcm.googleapis.com/fcm/send/mort';
    const fetchMock = vi.fn(async (u: string) => new Response(null, { status: u === mort ? 410 : 201 }));
    vi.stubGlobal('fetch', fetchMock);
    const r = await envoyerPush([vivant, mort], jwk, 'https://ahmed.test');
    vi.unstubAllGlobals();
    expect(r).toEqual({ envoyes: 1, expires: [mort] });
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, { method: string; headers: Record<string, string> }];
    expect(init.method).toBe('POST');
    const [t, k] = init.headers.Authorization.replace('vapid t=', '').split(', k=');
    expect(t.split('.')).toHaveLength(3);
    expect(k).toBe(cleVapidPublique(jwk));
    expect(init.headers.Urgency).toBe('high');
  });
});
