import { afterEach, describe, expect, it, vi } from 'vitest';
import { envoyerEmail } from './email';

const env = { RESEND_API_KEY: 're_test', MAIL_FROM: 'Commandes <c@x.tn>' };

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('envoyerEmail — logs', () => {
  it('logue les échecs (sinon un MAIL_FROM non vérifié passe inaperçu), pas les skipped', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('domain not verified', { status: 403 })));
    await envoyerEmail('a@b.tn', 's', 't', env);
    expect(log).toHaveBeenCalledTimes(1);
    expect(String(log.mock.calls[0].join(' '))).toContain('403');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('réseau')));
    await envoyerEmail('a@b.tn', 's', 't', env);
    expect(log).toHaveBeenCalledTimes(2);
    await envoyerEmail('a@b.tn', 's', 't', {});
    expect(log).toHaveBeenCalledTimes(2);
  });
});

describe('envoyerEmail via Brevo', () => {
  it('utilise Brevo si BREVO_API_KEY, avec expéditeur nom + email', async () => {
    const f = vi.fn().mockResolvedValue(new Response('{}', { status: 201 }));
    vi.stubGlobal('fetch', f);
    const e = { RESEND_API_KEY: 're_test', BREVO_API_KEY: 'xkeysib', MAIL_FROM: 'Commandes <contact@hamma-delivery.com>' };
    expect(await envoyerEmail('a@b.tn', 'S', 'T', e, '<p>H</p>')).toBe('sent');
    const [url, init] = f.mock.calls[0];
    expect(url).toBe('https://api.brevo.com/v3/smtp/email');
    expect(init.headers['api-key']).toBe('xkeysib');
    expect(JSON.parse(init.body)).toEqual({ sender: { name: 'Commandes', email: 'contact@hamma-delivery.com' }, to: [{ email: 'a@b.tn' }], subject: 'S', textContent: 'T', htmlContent: '<p>H</p>' });
  });
  it('sans MAIL_FROM : skipped, sans appel réseau', async () => {
    const f = vi.fn();
    vi.stubGlobal('fetch', f);
    expect(await envoyerEmail('a@b.tn', 'S', 'T', { BREVO_API_KEY: 'k' })).toBe('skipped');
    expect(f).not.toHaveBeenCalled();
  });
});

describe('envoyerEmail', () => {
  it('renvoie skipped sans clé, sans appeler fetch', async () => {
    const f = vi.fn();
    vi.stubGlobal('fetch', f);
    expect(await envoyerEmail('a@b.tn', 's', 't', {})).toBe('skipped');
    expect(f).not.toHaveBeenCalled();
  });
  it('renvoie sent sur 200 et envoie le bon payload', async () => {
    const f = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', f);
    expect(await envoyerEmail('a@b.tn', 'Sujet', 'Texte', env)).toBe('sent');
    const [url, init] = f.mock.calls[0];
    expect(url).toBe('https://api.resend.com/emails');
    expect(init.headers.Authorization).toBe('Bearer re_test');
    expect(JSON.parse(init.body)).toEqual({ from: env.MAIL_FROM, to: 'a@b.tn', subject: 'Sujet', text: 'Texte' });
  });
  it('renvoie failed sur 500', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('x', { status: 500 })));
    expect(await envoyerEmail('a@b.tn', 's', 't', env)).toBe('failed');
  });
  it('renvoie failed si fetch rejette', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('réseau')));
    expect(await envoyerEmail('a@b.tn', 's', 't', env)).toBe('failed');
  });
});

describe('envoyerEmail — expéditeur', () => {
  it('utilise l’expéditeur Resend par défaut sans MAIL_FROM', async () => {
    const f = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', f);
    await envoyerEmail('a@b.tn', 's', 't', { RESEND_API_KEY: 'k' });
    expect(JSON.parse(f.mock.calls[0][1].body).from).toBe('Commandes <onboarding@resend.dev>');
  });
});
