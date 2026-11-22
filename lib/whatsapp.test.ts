import { afterEach, describe, expect, it, vi } from 'vitest';
import { envoyerWhatsApp, lienEnvoiWhatsApp } from './whatsapp';

const env = { CALLMEBOT_APIKEY: '123456' };

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('envoyerWhatsApp (CallMeBot)', () => {
  it('skipped sans clé, sans appeler fetch', async () => {
    const f = vi.fn();
    vi.stubGlobal('fetch', f);
    expect(await envoyerWhatsApp('21693028832', 'x', {})).toBe('skipped');
    expect(f).not.toHaveBeenCalled();
  });
  it('envoie le texte au numéro du livreur', async () => {
    const f = vi.fn().mockResolvedValue(new Response('Message queued. You will receive it in a few seconds.', { status: 200 }));
    vi.stubGlobal('fetch', f);
    expect(await envoyerWhatsApp('21693028832', 'Commande N° AB12\nligne 2 & co', env)).toBe('sent');
    const u = new URL(f.mock.calls[0][0]);
    expect(u.origin + u.pathname).toBe('https://api.callmebot.com/whatsapp.php');
    expect(u.searchParams.get('phone')).toBe('+21693028832');
    expect(u.searchParams.get('text')).toBe('Commande N° AB12\nligne 2 & co');
    expect(u.searchParams.get('apikey')).toBe('123456');
  });
  it('failed si CallMeBot répond une erreur (même en HTTP 200) ou est injoignable', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('APIKey is invalid', { status: 200 })));
    expect(await envoyerWhatsApp('21693028832', 'x', env)).toBe('failed');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('réseau')));
    expect(await envoyerWhatsApp('21693028832', 'x', env)).toBe('failed');
    expect(log).toHaveBeenCalledTimes(2);
  });
});

describe('lienEnvoiWhatsApp', () => {
  it('ouvre WhatsApp vers le livreur avec le message complet (emojis et retours à la ligne gardés)', () => {
    const texte = '🛵 *COMMANDE N° AB12*\n▪️ 2× Pizza & co';
    const u = new URL(lienEnvoiWhatsApp('21693028832', texte));
    expect(u.origin + u.pathname).toBe('https://api.whatsapp.com/send');
    expect(u.searchParams.get('phone')).toBe('21693028832');
    expect(u.searchParams.get('text')).toBe(texte);
  });
});
