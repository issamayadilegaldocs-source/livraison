import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { signerBon } from './bon';
import { formaterPrix } from './commande';
import { getLivreur } from './livreur';
import { getMenu, getResto } from './catalogue';
import { autreOrigine, etatLivreur, lireConfigR2, modifiesDabord, pageCommandes, pageConfig, pagePush, recevoirBon, servirBon, traiterColis, traiterCommande, verifierCoupon, type DonneesResto, type Env, type SeauR2 } from './serveur';

// Données de test (test/fixtures/data) : Baguette & Baguette, ouvert lundi 11:00–21:00.
const ok = () => vi.fn(async (u: string) => new Response(String(u).includes('callmebot') ? 'Message queued.' : '{"id":"x"}', { status: 200 }));

/** Bucket R2 en mémoire. */
function seau(): SeauR2 & { objets: Map<string, Uint8Array | string> } {
  const objets = new Map<string, Uint8Array | string>();
  return {
    objets,
    head: async (k) => (objets.has(k) ? {} : null),
    get: async (k) => (objets.has(k) ? { body: new Response(objets.get(k) as BodyInit).body! } : null),
    put: async (k, v) => objets.set(k, v),
    delete: async (k) => objets.delete(k),
    list: async ({ prefix, limit = 1000 }) => ({ objects: [...objets.keys()].filter((k) => k.startsWith(prefix)).sort().slice(0, limit).map((key) => ({ key })) }),
  };
}

let env: Env;
beforeEach(() => {
  env = { RESEND_API_KEY: 're_test', BON_SECRET: 'secret-test', BONS: seau() };
  vi.stubGlobal('fetch', ok());
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-16T12:00:00+01:00'));
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

const resto = getResto('baguette-baguette')!;
const plat = getMenu(resto.id)!.plats.find((p) => p.groupes.every((g) => !g.obligatoire))!;
// client à 3 km du resto → frais 5,5 DT (voir lib/livraison.test.ts)
const position = { lat: resto.position.lat + 3 / 111.195, lng: resto.position.lng };
const attendu = Math.round((plat.prix + 5.5) * 1000) / 1000;

// Ce que la Function lit via env.ASSETS (/commande-data/<slug>), ici depuis les fixtures.
const lire = vi.fn(async (slug: string): Promise<DonneesResto | null> => {
  const r = getResto(slug);
  return r ? { resto: r, menu: getMenu(r.id)!, media: '/media' } : null;
});

const req = (body: unknown) =>
  new Request('https://speedy.test/api/commande', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
const commander = (body: unknown, e: Env = env) => traiterCommande(req(body), e, getLivreur(), lire);

const valide = {
  restoSlug: 'baguette-baguette',
  lignes: [{ platId: plat.id, qte: 1, choix: {} }],
  client: { nom: 'Sami', telephone: '22123456', adresse: '3 rue de Rome' },
  position,
};
const appels = () => (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls;

describe('traiterCommande (POST /api/commande)', () => {
  it('renvoie le message WhatsApp que le client enverra, avec le lien du bon', async () => {
    const res = await commander(valide);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toMatchObject({ numeroWhatsApp: '21600000000', total: attendu, email: 'sent', whatsappAuto: 'skipped' });
    expect(json.ref).toMatch(/^[A-Z0-9]{6}$/);
    expect(json.texteWhatsApp).toContain(`🛵 *NOUVELLE COMMANDE N° ${json.ref}*`);
    expect(json.texteWhatsApp).toContain('+216 22 123 456');
    expect(json.texteWhatsApp).toContain(`https://speedy.test/api/bon/${json.bon.id}`);
    expect(json.bon.id).toMatch(new RegExp(`^${json.ref}-[a-f0-9]{32}$`));
    expect(json.bon.sig).toBe(await signerBon(json.bon.id, 'secret-test'));
  });
  it('prépare les données du bon sans données client, images en URL absolue', async () => {
    const { bon } = await (await commander(valide)).json();
    expect(JSON.stringify(bon.donnees)).not.toContain('Sami');
    expect(JSON.stringify(bon.donnees)).not.toContain('22123456');
    expect(bon.donnees.lignes[0]).toMatchObject({ qte: 1, nom: plat.nom });
    if (plat.image) expect(bon.donnees.lignes[0].image).toMatch(/^https:\/\/speedy\.test\/media\/product\/thumb\//);
  });
  it('envoie l’email au livreur avec le lien du bon (texte et HTML)', async () => {
    const json = await (await commander(valide)).json();
    const mail = JSON.parse(appels().find(([u]) => String(u).includes('resend'))![1].body);
    expect(mail.to).toBe(getLivreur().email);
    expect(mail.text).toContain(`N° ${json.ref}`);
    expect(mail.text).toContain(`/api/bon/${json.bon.id}`);
    expect(mail.html).toContain(`/api/bon/${json.bon.id}`);
    expect(mail.attachments).toBeUndefined();
  });
  it('email client facultatif : sans email, un seul email part (au livreur)', async () => {
    await commander(valide);
    expect(appels().filter(([u]) => String(u).includes('resend'))).toHaveLength(1);
  });
  it('avec un email client : il reçoit le détail et le montant à payer, sans les données internes', async () => {
    const res = await commander({ ...valide, client: { ...valide.client, email: 'sami@example.com' } });
    expect(res.status).toBe(200);
    const mails = appels().filter(([u]) => String(u).includes('resend')).map(([, i]) => JSON.parse(i.body));
    const m = mails.find((x) => x.to === 'sami@example.com')!;
    expect(mails).toHaveLength(2);
    expect(m.text).toContain(`MONTANT À PAYER : ${formaterPrix(attendu)}`);
    expect(m.html).toContain('Montant à payer');
    expect(m.html).toContain(plat.nom.replace(/&/g, '&amp;'));
    expect(m.html + m.text).not.toMatch(/gain|commission|majoration/i);
  });
  it('refuse un email client invalide', async () => {
    expect((await commander({ ...valide, client: { ...valide.client, email: 'pas-un-email' } })).status).toBe(400);
  });
  it('sans BON_SECRET ou sans bucket : pas de bon, la commande part quand même', async () => {
    for (const e of [{ RESEND_API_KEY: 're_test' }, { RESEND_API_KEY: 're_test', BON_SECRET: 'x' }]) {
      const json = await (await commander(valide, e)).json();
      expect(json.bon).toBeNull();
      expect(json.texteWhatsApp).not.toContain('/bon/');
    }
  });
  it('accepte la commande même si l’email échoue (WhatsApp reste le canal principal)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 500 })));
    const res = await commander(valide);
    expect(res.status).toBe(200);
    expect((await res.json()).email).toBe('failed');
  });
  it('envoie aussi WhatsApp automatiquement si une clé CallMeBot est configurée', async () => {
    const json = await (await commander(valide, { ...env, CALLMEBOT_APIKEY: 'k' })).json();
    expect(json.whatsappAuto).toBe('sent');
    expect(appels().some(([u]) => String(u).includes('api.callmebot.com') && String(u).includes('phone=%2B21600000000'))).toBe(true);
  });
  it('ignore un prix injecté', async () => {
    const res = await commander({ ...valide, lignes: [{ platId: plat.id, qte: 1, prix: 0.001 }], total: 0 });
    expect((await res.json()).total).toBe(attendu);
  });
  it('404 pour un resto inconnu, sans lire de fichier pour un slug douteux', async () => {
    expect((await commander({ ...valide, restoSlug: 'nexiste-pas' })).status).toBe(404);
    lire.mockClear();
    expect((await commander({ ...valide, restoSlug: '../livreur' })).status).toBe(404);
    expect(lire).not.toHaveBeenCalled();
  });
  it('400 pour un body invalide', async () => {
    expect((await commander({ ...valide, lignes: [] })).status).toBe(400);
    expect((await commander('pas du json')).status).toBe(400);
  });
  it('400 si le resto est fermé (l’heure du serveur fait foi, pas celle de la page)', async () => {
    vi.setSystemTime(new Date('2026-11-16T23:30:00+01:00'));
    const res = await commander(valide);
    expect(res.status).toBe(400);
    expect((await res.json()).erreur).toContain('fermé');
  });
});

describe('bons (POST et GET /api/bon/<id>)', () => {
  const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
  const id = 'AB12CD-0123456789abcdef0123456789abcdef';
  const envoi = (sig: string, corps: Uint8Array | string = PNG) =>
    recevoirBon(new Request(`https://speedy.test/api/bon/${id}?sig=${sig}`, { method: 'POST', body: corps as BodyInit }), env, id);

  it('enregistre un bon signé puis le sert en PNG', async () => {
    expect((await envoi(await signerBon(id, 'secret-test'))).status).toBe(200);
    const res = await servirBon(env, id);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('image/png');
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(PNG);
  });
  it('refuse une signature fausse (403) et un contenu qui n’est pas un PNG (400)', async () => {
    expect((await envoi('0'.repeat(64))).status).toBe(403);
    expect((await envoi(await signerBon(id, 'autre-secret'))).status).toBe(403);
    expect((await envoi(await signerBon(id, 'secret-test'), 'pas une image')).status).toBe(400);
  });
  it('n’écrase jamais un bon déjà enregistré', async () => {
    const sig = await signerBon(id, 'secret-test');
    await envoi(sig);
    const autre = new Uint8Array([...PNG, 9, 9]);
    expect((await envoi(sig, autre)).status).toBe(200);
    expect(new Uint8Array(await (await servirBon(env, id)).arrayBuffer())).toEqual(PNG);
  });
  it('refuse une image trop lourde', async () => {
    const gros = new Uint8Array(1_600_000);
    gros.set(PNG);
    expect((await envoi(await signerBon(id, 'secret-test'), gros)).status).toBe(413);
  });
  it('404 pour un bon inconnu ou un identifiant mal formé', async () => {
    expect((await servirBon(env, id)).status).toBe(404);
    expect((await servirBon(env, '../secret')).status).toBe(404);
  });
});

describe('config du livreur (/api/config, /api/etat, effet sur la commande)', () => {
  const CLE = 'cle-du-livreur';
  const envC = () => ({ ...env, CONFIG_CLE: CLE });
  const restos = async () => [{ slug: 'baguette-baguette', nom: 'Baguette & Baguette' }];
  const page = (champs: Record<string, string> | null, query = `cle=${CLE}`) =>
    pageConfig(
      new Request(`https://speedy.test/api/config?${query}`, {
        method: champs ? 'POST' : 'GET',
        ...(champs && { headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ cle: CLE, ...champs }).toString() }),
      }),
      envC(),
      getLivreur(),
      lire,
      restos,
    );
  const etat = async (resto = '') => (await etatLivreur(new Request(`https://speedy.test/api/etat${resto && `?resto=${resto}`}`), envC(), getLivreur())).json();

  it('404 sans la bonne clé, ou sans CONFIG_CLE configurée', async () => {
    expect((await page(null, 'cle=mauvaise')).status).toBe(404);
    expect((await pageConfig(new Request('https://speedy.test/api/config?cle='), env, getLivreur(), lire, restos)).status).toBe(404);
  });
  it('affiche les quatre réglages et la liste des restos', async () => {
    const html = await (await page(null)).text();
    for (const t of ['Site ouvert', 'Horaires', 'Frais de livraison', 'Plats et restos', 'Baguette &amp; Baguette']) expect(html).toContain(t);
  });
  it('pause puis reprise : la commande est refusée puis acceptée', async () => {
    const res = await page({ action: 'pause' });
    expect(res.status).toBe(303);
    expect(res.headers.get('location')).toBe(`/api/config?cle=${CLE}&ok=1`);
    expect((await etat()).pause).toBe(true);
    const refus = await commander(valide);
    expect(refus.status).toBe(400);
    expect((await refus.json()).erreur).toContain('pause');
    await page({ action: 'reprendre' });
    expect((await commander(valide)).status).toBe(200);
  });
  it('horaires du livreur : commande refusée hors horaires, puis horaires retirés', async () => {
    await page({ action: 'horaires', auto: 'on', ouvre: '18:00', ferme: '23:00' }); // horloge figée à 12:00
    expect((await etat()).service).toEqual({ ouvre: '18:00', ferme: '23:00' });
    expect((await (await commander(valide)).json()).erreur).toContain('reprise à 18:00');
    await page({ action: 'horaires' }); // case décochée
    expect((await etat()).service).toBeNull();
    expect((await commander(valide)).status).toBe(200);
  });
  it('horaires invalides : message, rien d’enregistré', async () => {
    const res = await page({ action: 'horaires', auto: 'on', ouvre: '25:00', ferme: '23:00' });
    expect(res.status).toBe(400);
    expect(await res.text()).toContain('Horaires invalides');
    expect((await lireConfigR2(envC(), getLivreur())).service).toBeUndefined();
  });
  it('frais du livreur : utilisés par le calcul de la commande', async () => {
    await page({ action: 'frais', base: '1', parKm: '0,5', min: '1', max: '12', rayonMaxKm: '15' });
    const { livraison } = await etat();
    expect(livraison).toMatchObject({ base: 1, parKm: 0.5, min: 1, max: 12, rayonMaxKm: 15 });
    // 3,9 km route → 1 + 1,95 = 2,95 → 3 DT (au lieu de 5,5 avec les frais de la fixture)
    expect((await (await commander(valide)).json()).total).toBe(Math.round((plat.prix + 3) * 1000) / 1000);
  });
  it('un seul bouton « Enregistrer » pour horaires + frais (action reglages)', async () => {
    await page({ action: 'reglages', auto: 'on', ouvre: '18:00', ferme: '23:00', base: '2', parKm: '1', min: '2', max: '10', rayonMaxKm: '12' });
    const e = await etat();
    expect(e.service).toEqual({ ouvre: '18:00', ferme: '23:00' });
    expect(e.livraison).toMatchObject({ base: 2, parKm: 1, rayonMaxKm: 12 });
    expect((await page({ action: 'reglages', auto: 'on', ouvre: '25:00', ferme: '23:00', base: '2', parKm: '1', min: '2', max: '10', rayonMaxKm: '12' })).status).toBe(400);
  });
  it('prix client fixé : à payer au resto = prix du menu, gain = livraison + différence', async () => {
    await page({ action: 'plats', resto: 'baguette-baguette', [`prix_${plat.id}`]: '20' });
    const json = await (await commander(valide)).json();
    const mail = JSON.parse(appels().find(([u]) => String(u).includes('resend'))![1].body);
    expect(json.total).toBe(20 + 5.5);
    expect(mail.text).toContain(`SOMME DUE AU RESTAURANT : ${formaterPrix(plat.prix)}`);
    expect(mail.text).toContain(`VOTRE GAIN : ${formaterPrix(5.5 + 20 - plat.prix)}`);
  });
  it('un écran par réglage, avec explication et exemple ; chaque lien de l’accueil mène à un écran qui existe', async () => {
    const html = await (await page({})).text();
    for (const v of ['horaires', 'frais', 'colis', 'livraison-gratuite', 'frais-service', 'commission', 'promos', 'coupons']) {
      expect(html).toContain(`data-vue="${v}"`); // l’écran existe
      expect(html).toContain(`href="#${v}"`); // et l’accueil y mène
      expect(html).toContain(v.includes('-') ? `'${v}':` : `${v}:`); // et l’ancre l’ouvre
    }
    expect(html.match(/À quoi ça sert \?/g)!.length).toBeGreaterThanOrEqual(5);
    for (const t of ['Frais de service', 'Commission par resto', 'Promotions', 'Frais de livraison', 'Horaires', 'Qui paie la remise ?']) expect(html).toContain(t);
  });
  it('accueil simplifié : plus d’onglet Prix ni de liste de réglages ; commission seulement par resto', async () => {
    const html = await (await page({})).text();
    expect(html).not.toContain('data-n="prix"');
    expect(html).not.toContain('Tout régler');
    expect(html).not.toContain('Pour tous les restos');
    expect(html).not.toContain('ct_tous');
    expect(html).not.toContain('ct_cat_');
    const resto = await (await page(null, `cle=${CLE}&resto=baguette-baguette`)).text();
    expect(resto).toContain('name="ct_resto"');
    expect(resto).not.toContain('name="commission"'); // plus de commission sur la page d'un plat
  });
  it('page de config : « Mettre par défaut » = formule standard ; case décochée = aucun', async () => {
    await page({ action: 'frais-service', defaut: '1' });
    expect((await etat()).fraisService).toEqual({ pourcent: 8, min: 0.8, max: 5 });
    await page({ action: 'frais-service', fs_actif: 'on', fs_pourcent: '5', fs_min: '1', fs_max: '3' });
    expect((await etat()).fraisService).toEqual({ pourcent: 5, min: 1, max: 3 });
    expect((await page({ action: 'frais-service', fs_actif: 'on', fs_pourcent: '5', fs_min: '4', fs_max: '3' })).status).toBe(400);
    await page({ action: 'frais-service' });
    expect((await etat()).fraisService).toBeNull();
  });
  it('page de config : commission par resto (case vide = aucune), puis effet sur la commande', async () => {
    const mail = () => JSON.parse(appels().filter(([u]) => String(u).includes('resend')).at(-1)![1].body).text as string;
    await commander(valide);
    expect(mail()).not.toContain('commission sur le resto');
    await page({ action: 'commission-resto', resto: 'baguette-baguette', ct_resto: '20' });
    await commander(valide);
    expect(mail()).toContain(`commission sur le resto : ${formaterPrix(Math.round(plat.prix * 200) / 1000)}`);
    await page({ action: 'commission-resto', resto: 'baguette-baguette', ct_resto: '' });
    await commander(valide);
    expect(mail()).not.toContain('commission sur le resto');
    expect((await page({ action: 'commission-resto', resto: 'baguette-baguette', ct_resto: '150' })).status).toBe(400);
  });
  it('la commission enregistrée se voit dans la liste des restos', async () => {
    const r = await page({ action: 'commission-resto', resto: 'baguette-baguette', ct_resto: '12' });
    expect(r.headers.get('location')).toContain('ok=commission');
    expect(r.headers.get('location')).not.toContain('resto=');
    const liste = await (await page(null)).text();
    expect(liste).toContain('<span class="pr">12 %</span>');
    // les restos avec commission passent en premier
    const dansCom = liste.slice(liste.indexOf('id="listecom"'));
    const sans = dansCom.indexOf('<span class="pr"></span>');
    if (sans >= 0) expect(dansCom.indexOf('resto=baguette-baguette#commission')).toBeLessThan(sans);
    expect(await (await page(null, `cle=${CLE}&resto=baguette-baguette`)).text()).toContain('value="12"');
  });
  it('promo sur un seul plat : posée depuis la page du plat, seul ce plat est remisé', async () => {
    const r = await page({ action: 'promo-ajouter', resto: 'baguette-baguette', plat: String(plat.id), nom: 'Promo plat', type: 'montant', valeur: '2', financeur: 'resto' });
    expect(r.headers.get('location')).toContain('#simple');
    expect((await etat()).promos[0]).toMatchObject({ plat: plat.id, resto: 'baguette-baguette' });
    const json = await (await commander(valide)).json();
    expect(json.total).toBe(Math.round((plat.prix - 2 + 5.5) * 1000) / 1000);
    expect((await page({ action: 'promo-ajouter', resto: 'baguette-baguette', plat: '999999', nom: 'X', type: 'montant', valeur: '2', financeur: 'resto' })).status).toBe(400);
    expect((await page({ action: 'promo-ajouter', plat: String(plat.id), nom: 'X', type: 'montant', valeur: '2', financeur: 'resto' })).status).toBe(400);
  });
  it('livraison gratuite : le client ne paie pas la livraison, le livreur la prend à sa charge', async () => {
    await page({ action: 'livraison-gratuite', fg: 'on', fg_min: '' });
    expect((await etat()).livraisonGratuite).toEqual({});
    const json = await (await commander(valide)).json();
    const mail = JSON.parse(appels().filter(([u]) => String(u).includes('resend')).at(-1)![1].body).text as string;
    expect(json.total).toBe(plat.prix); // plus de livraison
    expect(json.texteWhatsApp).toContain('offerte');
    expect(mail).toContain('Livraison : OFFERTE');
    expect(mail).toContain('VOTRE GAIN : 0,000 DT');
    await page({ action: 'livraison-gratuite', fg: 'on', fg_min: '1000' }); // panier trop petit : redevient payante
    expect((await etat()).livraisonGratuite).toEqual({ min: 1000 });
    expect((await (await commander(valide)).json()).total).toBeGreaterThan(plat.prix);
    await page({ action: 'livraison-gratuite', fg: 'off' });
    expect((await etat()).livraisonGratuite).toBeNull();
  });
  it('coupon sur un plat posé depuis la page du plat : visible dans la liste, appliqué avec son code', async () => {
    await page({ action: 'coupon-ajouter', resto: 'baguette-baguette', plat: String(plat.id), nom: 'Promo Glad', code: 'glad', type: 'pourcent', valeur: '25', financeur: 'livreur' });
    const liste = await (await page(null)).text();
    expect(liste).toContain('Code « GLAD »'); // dans la liste des promos
    expect(liste).toContain('GLAD'); // le code sert aussi de nom : un seul champ
    const json = await (await commander({ ...valide, code: 'glad' })).json();
    expect(json.texteWhatsApp).toMatch(/Coupon GLAD : −/); // le client lit « Coupon GLAD », pas un nom
    const remise = Math.round(plat.prix * 250) / 1000; // 25 % du plat
    expect(json.total).toBe(Math.round((plat.prix - remise + 5.5) * 1000) / 1000);
    expect((await etat()).promos).toHaveLength(0); // un coupon n'est jamais publié
    const pagePlat = await (await page(null, `cle=${CLE}&simple=1&resto=baguette-baguette&plat=${plat.id}`)).text();
    expect(pagePlat).toContain('Code « GLAD »'); // et sur la page du plat
  });
  it('promotion et coupon se créent séparément : une promotion n’a jamais de code, un coupon en exige un', async () => {
    // une promotion ignore tout code envoyé : elle reste automatique (publiée), jamais un coupon caché
    await page({ action: 'promo-ajouter', nom: 'Auto', code: 'CACHE1', cumulable: 'on', limite: '5', type: 'montant', valeur: '1', financeur: 'livreur' });
    const e = await etat();
    expect(e.promos).toHaveLength(1);
    expect(JSON.stringify(e)).not.toContain('CACHE1');
    // un coupon sans code est refusé, avec un message clair
    const sans = await page({ action: 'coupon-ajouter', nom: 'Sans', type: 'montant', valeur: '1', financeur: 'livreur' });
    expect(sans.status).toBe(400);
    expect(await sans.text()).toContain('besoin d’un code');
    // chaque liste ne montre que ses éléments
    await page({ action: 'coupon-ajouter', nom: 'Vrai coupon', code: 'VRAI10', type: 'montant', valeur: '1', financeur: 'livreur' });
    const html = await (await page(null)).text();
    const promos = html.slice(html.indexOf('data-vue="promos"'), html.indexOf('data-vue="coupons"'));
    const coupons = html.slice(html.indexOf('data-vue="coupons"'), html.indexOf('data-vue="prix"'));
    expect(promos).toContain('Auto');
    expect(promos).not.toContain('VRAI10');
    expect(coupons).toContain('VRAI10');
    expect(coupons).not.toContain('Auto');
  });
  it('coupon cumulable : s’ajoute à la promo automatique ; non cumulable : la remplace', async () => {
    await page({ action: 'promo-ajouter', nom: 'Auto', type: 'pourcent', valeur: '10', financeur: 'livreur' });
    await page({ action: 'coupon-ajouter', nom: 'Seul', code: 'SEUL2', type: 'montant', valeur: '2', financeur: 'livreur' });
    await page({ action: 'coupon-ajouter', nom: 'Plus', code: 'PLUS2', cumulable: 'on', type: 'montant', valeur: '2', financeur: 'livreur' });
    const auto = Math.round((plat.prix * 1000) / 10) / 1000;
    const total = async (code?: string) => (await (await commander({ ...valide, ...(code && { code }) })).json()).total as number;
    expect(await total()).toBe(Math.round((plat.prix - auto + 5.5) * 1000) / 1000); // promo automatique seule
    expect(await total('SEUL2')).toBe(Math.round((plat.prix - 2 + 5.5) * 1000) / 1000); // remplace
    expect(await total('PLUS2')).toBe(Math.round((plat.prix - 2 - auto + 5.5) * 1000) / 1000); // cumul
    expect((await page({ action: 'promo-ajouter', nom: 'X', cumulable: 'on', type: 'montant', valeur: '1', financeur: 'livreur' })).status).toBe(303); // sans code : case ignorée
  });
  it('coupon à limite : refusé quand il a servi autant de fois que permis', async () => {
    await page({ action: 'coupon-ajouter', nom: 'Limité', code: 'DEUX', limite: '2', type: 'montant', valeur: '1', financeur: 'livreur' });
    const verifier = () => verifierCoupon(new Request('https://speedy.test/api/coupon', { method: 'POST', body: JSON.stringify({ code: 'DEUX', resto: 'baguette-baguette' }) }), envC(), getLivreur());
    expect((await verifier()).status).toBe(200);
    expect((await commander({ ...valide, code: 'DEUX' })).status).toBe(200);
    expect((await commander({ ...valide, code: 'DEUX' })).status).toBe(200);
    const res = await commander({ ...valide, code: 'DEUX' });
    expect(res.status).toBe(400);
    expect((await res.json()).erreur).toContain('maximum');
    expect((await verifier()).status).toBe(404);
    expect(await (await page(null)).text()).toContain('Utilisé 2 fois sur 2');
    expect((await commander(valide)).status).toBe(200); // sans code, tout va bien
  });
  it('coupon : caché du public, vérifié par le serveur, appliqué seulement avec le bon code', async () => {
    await page({ action: 'coupon-ajouter', nom: 'Bienvenue', code: 'bienvenue10', type: 'montant', valeur: '2', financeur: 'livreur' });
    expect((await etat()).promos).toHaveLength(0); // jamais publié : sinon tout le monde le verrait
    const verifier = (code: string, resto = 'baguette-baguette') =>
      verifierCoupon(new Request('https://speedy.test/api/coupon', { method: 'POST', body: JSON.stringify({ code, resto }) }), envC(), getLivreur());
    const ok = await verifier('  bienvenue10 ');
    expect(ok.status).toBe(200);
    const vue = (await ok.json()).promo;
    expect(vue).toMatchObject({ nom: 'BIENVENUE10', type: 'montant', valeur: 2 }); // nom = code
    expect(JSON.stringify(vue)).not.toMatch(/financeur|partResto/);
    expect((await verifier('FAUX1234')).status).toBe(404);
    // commande : sans code pas de remise, avec le code oui, mauvais code refusé
    expect((await (await commander(valide)).json()).total).toBe(Math.round((plat.prix + 5.5) * 1000) / 1000);
    expect((await (await commander({ ...valide, code: 'bienvenue10' })).json()).total).toBe(Math.round((plat.prix - 2 + 5.5) * 1000) / 1000);
    expect((await commander({ ...valide, code: 'FAUX1234' })).status).toBe(400);
    // un même code ne peut pas être créé deux fois
    expect((await page({ action: 'coupon-ajouter', nom: 'Autre', code: 'BIENVENUE10', type: 'montant', valeur: '1', financeur: 'livreur' })).status).toBe(400);
    expect((await page({ action: 'coupon-ajouter', nom: 'Mauvais', code: 'a b', type: 'montant', valeur: '1', financeur: 'livreur' })).status).toBe(400);
  });
  it('resto fermé : refusé à la commande, rouvert par le même bouton', async () => {
    await page({ action: 'resto-ferme', resto: 'baguette-baguette', f: '1' });
    expect((await etat()).restosFermes).toEqual(['baguette-baguette']);
    const res = await commander(valide);
    expect(res.status).toBe(400);
    expect((await res.json()).erreur).toContain('indisponible');
    await page({ action: 'resto-ferme', resto: 'baguette-baguette', f: '0' });
    expect((await etat()).restosFermes).toEqual([]);
    expect((await commander(valide)).status).toBe(200);
  });
  it('commande minimum : refusée en dessous, acceptée au-dessus, retirée par « off »', async () => {
    await page({ action: 'minimum', mn_val: '1000' });
    const res = await commander(valide);
    expect(res.status).toBe(400);
    expect((await res.json()).erreur).toContain('Commande minimum');
    await page({ action: 'minimum', mn: 'off' });
    expect((await etat()).commandeMin).toBeNull();
    expect((await commander(valide)).status).toBe(200);
    expect((await page({ action: 'minimum', mn_val: '-3' })).status).toBe(400);
  });
  it('supplément pluie : payé par le client, pour le livreur, visible dans les messages', async () => {
    await page({ action: 'supplement', sm_actif: 'on', sm_montant: '1.5', sm_libelle: 'Pluie' });
    const json = await (await commander(valide)).json();
    const mail = JSON.parse(appels().filter(([u]) => String(u).includes('resend')).at(-1)![1].body).text as string;
    expect(json.total).toBe(Math.round((plat.prix + 5.5 + 1.5) * 1000) / 1000);
    expect(json.texteWhatsApp).toContain('Supplément Pluie : 1,500 DT');
    expect(mail).toContain(`VOTRE GAIN : ${formaterPrix(5.5 + 1.5)}`);
    await page({ action: 'supplement' }); // tout vide : plus de supplément
    expect((await (await commander(valide)).json()).total).toBe(Math.round((plat.prix + 5.5) * 1000) / 1000);
    expect((await page({ action: 'supplement', sm_actif: 'on', sm_montant: '99' })).status).toBe(400);
  });
  it('livraison gratuite dès un montant : la promo ne fait pas perdre la livraison gratuite', async () => {
    await page({ action: 'livraison-gratuite', fg: 'on', fg_min: String(plat.prix) }); // pile le prix du plat
    await page({ action: 'promo-ajouter', nom: 'Remise', type: 'montant', valeur: '1', financeur: 'livreur' });
    const json = await (await commander(valide)).json();
    expect(json.total).toBe(Math.round((plat.prix - 1) * 1000) / 1000); // promo déduite, livraison offerte quand même
  });
  it('livraison gratuite : le supplément n’est pas facturé non plus', async () => {
    await page({ action: 'supplement', sm_actif: 'on', sm_montant: '1.5', sm_libelle: 'Pluie' });
    await page({ action: 'livraison-gratuite', fg: 'on', fg_min: '' });
    expect((await (await commander(valide)).json()).total).toBe(plat.prix);
  });
  it('message d’annonce et montants de pourboire', async () => {
    await page({ action: 'annonce', texte: '  Fermé jeudi  ' });
    expect((await etat()).annonce).toBe('Fermé jeudi');
    await page({ action: 'annonce', an: 'off' });
    expect((await etat()).annonce).toBeNull();
    expect((await page({ action: 'annonce', texte: 'x'.repeat(200) })).status).toBe(400);
    expect((await etat()).pourboires).toEqual([1, 2, 3, 5]);
    await page({ action: 'pourboires', pb1: '4', pb2: '2', pb3: '2' });
    expect((await etat()).pourboires).toEqual([2, 4]); // triés, sans doublon
    expect((await page({ action: 'pourboires', pb1: '500' })).status).toBe(400);
    await page({ action: 'pourboires', reset: '1' });
    expect((await etat()).pourboires).toEqual([1, 2, 3, 5]);
  });
  it('prix du resto modifiable : la somme due au resto suit, le client paie le prix qu’on lui a fixé', async () => {
    const plus = Math.round((plat.prix + 1) * 1000) / 1000;
    const client = Math.round((plat.prix + 4) * 1000) / 1000;
    await page({ action: 'prix1', resto: 'baguette-baguette', plat: String(plat.id), prix_resto: String(plus), prix: String(client) });
    const json = await (await commander(valide)).json();
    const mail = JSON.parse(appels().filter(([u]) => String(u).includes('resend')).at(-1)![1].body).text as string;
    expect(json.total).toBe(Math.round((client + 5.5) * 1000) / 1000);
    expect(mail).toContain(`SOMME DUE AU RESTAURANT : ${formaterPrix(plus)}`);
    expect(mail).toContain(`VOTRE GAIN : ${formaterPrix(5.5 + 3)}`); // livraison + (client − resto)
    expect(JSON.stringify((await etat()).plats)).not.toMatch(/resto/); // jamais publié
    expect(json.bon.donnees.sousTotal).toBe(formaterPrix(plus)); // le bon du resto montre son nouveau prix
    // la page propose le prix corrigé et le marque
    const html = await (await page(null, `cle=${CLE}&simple=1&resto=baguette-baguette&plat=${plat.id}`)).text();
    expect(html).toContain('name="prix_resto"');
    expect(html).toContain(`value="${String(plus).replace('.', ',')}`);
    // vide = retour au prix du menu
    await page({ action: 'prix1', resto: 'baguette-baguette', plat: String(plat.id), prix_resto: '', prix: String(plat.prix) });
    expect((await (await commander(valide)).json()).total).toBe(Math.round((plat.prix + 5.5) * 1000) / 1000);
    expect((await page({ action: 'prix1', resto: 'baguette-baguette', plat: String(plat.id), prix_resto: 'abc', prix: '10' })).status).toBe(400);
  });
  it('prix du resto corrigé sans prix client fixé : le client paie le nouveau prix + la majoration', async () => {
    // correction enregistrée directement (la page la crée quand le client suit le prix par défaut)
    await env.BONS!.put('config/21600000000.json', JSON.stringify({ plats: { 'baguette-baguette': { [plat.id]: { resto: plat.prix + 2 } } } }));
    expect((await (await commander(valide)).json()).total).toBe(Math.round((plat.prix + 2 + 5.5) * 1000) / 1000);
  });
  it('page de config : ajouter, désactiver et supprimer une promo ; le client la voit sans savoir qui la paie', async () => {
    await page({ action: 'promo-ajouter', nom: 'Bienvenue', type: 'montant', valeur: '2', financeur: 'partage', partResto: '40' });
    const e = await etat();
    expect(e.promos).toHaveLength(1);
    expect(e.promos[0]).toMatchObject({ nom: 'Bienvenue', type: 'montant', valeur: 2 });
    expect(JSON.stringify(e)).not.toMatch(/financeur|partResto/);
    const json = await (await commander(valide)).json();
    expect(json.total).toBe(Math.round((plat.prix - 2 + 5.5) * 1000) / 1000);
    const id = e.promos[0].id;
    await page({ action: 'promo-actif', id });
    expect((await etat()).promos).toHaveLength(0); // désactivée : plus offerte
    await page({ action: 'promo-suppr', id });
    expect((await page({ action: 'promo-actif', id })).status).toBe(400);
    expect((await page({ action: 'promo-ajouter', nom: 'X', type: 'pourcent', valeur: '150', financeur: 'livreur' })).status).toBe(400);
    expect((await page({ action: 'promo-ajouter', nom: 'X', type: 'pourcent', valeur: '10', financeur: 'partage' })).status).toBe(400);
  });
  it('frais incohérents refusés (minimum > maximum)', async () => {
    expect((await page({ action: 'frais', base: '1', parKm: '1', min: '20', max: '5', rayonMaxKm: '10' })).status).toBe(400);
  });
  it('nouveau prix d’un plat : affiché via /api/etat et facturé par le serveur', async () => {
    const res = await page({ action: 'plats', resto: 'baguette-baguette', [`prix_${plat.id}`]: '9,9' });
    expect(res.headers.get('location')).toContain('resto=baguette-baguette');
    expect((await etat('baguette-baguette')).plats).toEqual({ [plat.id]: { prix: 9.9 } });
    expect((await (await commander(valide)).json()).total).toBe(Math.round((9.9 + 5.5) * 1000) / 1000);
  });
  it('plat indisponible : refusé à la commande ; « revenir aux prix du menu » efface tout', async () => {
    await page({ action: 'plats', resto: 'baguette-baguette', [`indispo_${plat.id}`]: 'on' });
    expect((await (await commander(valide)).json()).erreur).toContain('plus disponible');
    await page({ action: 'plats-reset', resto: 'baguette-baguette' });
    expect((await etat('baguette-baguette')).plats).toEqual({});
    expect((await commander(valide)).status).toBe(200);
  });
  it('un prix égal au prix du menu n’est pas gardé comme correction', async () => {
    await page({ action: 'plats', resto: 'baguette-baguette', [`prix_${plat.id}`]: String(plat.prix) });
    expect((await etat('baguette-baguette')).plats).toEqual({});
  });
  it('page d’un resto : prix initial, nouveau prix, prix client, et récap dans la liste des restos', async () => {
    await page({ action: 'plats', resto: 'baguette-baguette', [`prix_${plat.id}`]: '9,9', [`indispo_${plat.id}`]: 'on' });
    const html = await (await page(null, `cle=${CLE}&resto=baguette-baguette`)).text();
    for (const t of ['Resto', 'Plat indisponible', 'Remettre', 'Majoration', `name="prix_${plat.id}"`, `data-init="${plat.prix}"`, 'class="plat mod pm"', 'value="9,900"']) expect(html).toContain(t);
    const liste = await (await page(null)).text();
    for (const t of ['1 prix modifié', '1 indispo', 'data-mod="1"', 'data-vue="prix"', 'nav class="bas"']) expect(liste).toContain(t);
  });
  it('parcours simple : un plat, un champ ; redirige vers l’écran simple ; prix du menu = correction retirée', async () => {
    const res = await page({ action: 'prix1', resto: 'baguette-baguette', plat: String(plat.id), prix: '9,9' });
    expect(res.status).toBe(303);
    expect(res.headers.get('location')).toContain('simple=1');
    expect(res.headers.get('location')).toContain('#simple');
    expect((await etat('baguette-baguette')).plats).toEqual({ [plat.id]: { prix: 9.9 } });
    await page({ action: 'prix1', resto: 'baguette-baguette', plat: String(plat.id), prix: String(plat.prix) });
    expect((await etat('baguette-baguette')).plats).toEqual({});
    expect((await page({ action: 'prix1', resto: 'baguette-baguette', plat: String(plat.id), prix: 'abc' })).status).toBe(400);
    expect((await page({ action: 'prix1', resto: 'baguette-baguette', plat: '999999', prix: '5' })).status).toBe(400);
  });
  it('parcours simple : les restos déjà modifiés passent en premier, avec leur badge', async () => {
    expect(modifiesDabord([{ id: 'a', n: 0 }, { id: 'b', n: 2 }, { id: 'c', n: 0 }, { id: 'd', n: 1 }]).map((x) => x.id)).toEqual(['b', 'd', 'a', 'c']);
    await page({ action: 'prix1', resto: 'baguette-baguette', plat: String(plat.id), prix: '9,9' });
    const html = await (await page(null, `cle=${CLE}&simple=1`)).text();
    expect(html.slice(html.indexOf('id="lr"'))).toContain('1 prix modifié');
  });
  it('parcours simple : 3 étapes (resto, plat, un seul champ prix)', async () => {
    expect(await (await page(null, `cle=${CLE}&simple=1`)).text()).toContain('Touchez le resto');
    expect(await (await page(null, `cle=${CLE}&simple=1&resto=baguette-baguette`)).text()).toContain('Touchez le plat');
    const html = await (await page(null, `cle=${CLE}&simple=1&resto=baguette-baguette&plat=${plat.id}`)).text();
    for (const t of ['Le client paie', 'name="action" value="prix1"', 'Enregistrer le prix']) expect(html).toContain(t);
  });
  it('échappe le nom du livreur dans la page', async () => {
    const html = await (await pageConfig(new Request(`https://speedy.test/api/config?cle=${CLE}`), envC(), { ...getLivreur(), nom: '<script>x</script>' }, lire, restos)).text();
    expect(html).not.toContain('<script>x');
  });
});

describe('frais de service dans la commande', () => {
  const avecService = { ...getLivreur(), fraisService: { pourcent: 10, min: 1, max: 5 } };
  it('ajoutés au total, ligne à part pour le client, dans le gain du livreur', async () => {
    const json = await (await traiterCommande(req(valide), env, avecService, lire)).json();
    const fs = Math.min(5, Math.max(1, Math.round(plat.prix * 100) / 1000));
    expect(json.total).toBe(Math.round((plat.prix + 5.5 + fs) * 1000) / 1000);
    expect(json.texteWhatsApp).toContain(`Frais de service : ${formaterPrix(fs)}`);
    const mail = JSON.parse(appels().find(([u]) => String(u).includes('resend'))![1].body);
    expect(mail.text).toContain(`VOTRE GAIN : ${formaterPrix(5.5 + fs)}`);
    expect(mail.text).toContain(`frais de service : ${formaterPrix(fs)}`);
    expect(mail.html).toContain('Frais de service');
  });
});

describe('alerte Telegram du livreur', () => {
  const avecTelegram = { ...getLivreur(), telegram: { chatId: '123456789', appel: '@livreur_ahmed' } };
  const telegram = () => appels().filter(([u]) => String(u).includes('api.telegram.org'));
  it('message Telegram avec les montants et les boutons, plus l’appel demandé', async () => {
    await traiterCommande(req(valide), env, avecTelegram, lire);
    expect(telegram()).toHaveLength(0); // sans TELEGRAM_BOT_TOKEN : rien
    env.TELEGRAM_BOT_TOKEN = '123:abc';
    await traiterCommande(req(valide), env, avecTelegram, lire);
    const corps = JSON.parse(telegram()[0][1].body);
    expect(corps.chat_id).toBe('123456789');
    expect(corps.text).toMatch(/SOMME DUE|Somme due au restaurant/i);
    expect(corps.text).toContain('Votre gain');
    expect(corps.reply_markup.inline_keyboard.flat().map((b: { text: string }) => b.text).join()).toContain('WhatsApp client');
    expect(appels().some(([u]) => String(u).includes('callmebot.com/start.php') && String(u).includes('livreur_ahmed'))).toBe(true);
  });
  it('livreur sans telegram : aucun appel Telegram', async () => {
    env.TELEGRAM_BOT_TOKEN = '123:abc';
    await commander(valide);
    expect(telegram()).toHaveLength(0);
  });
});

describe('commission du livreur et promos', () => {
  const livreurAvec = (extra: object) => ({ ...getLivreur(), ...extra });
  const mailDe = () => JSON.parse(appels().find(([u]) => String(u).includes('resend'))![1].body);
  const lancer = async (extra: object) => (await traiterCommande(req(valide), env, livreurAvec(extra), lire)).json();

  it('commission 10 % : retirée de la somme due au resto, ajoutée au gain', async () => {
    const json = await lancer({ commission: { restos: { 'baguette-baguette': 10 } } });
    const com = Math.round(plat.prix * 100) / 1000;
    expect(json.total).toBe(Math.round((plat.prix + 5.5) * 1000) / 1000); // le client ne voit rien
    expect(mailDe().text).toContain(`SOMME DUE AU RESTAURANT : ${formaterPrix(plat.prix - com)}`);
    expect(mailDe().text).toContain(`VOTRE GAIN : ${formaterPrix(5.5 + com)}`);
    expect(mailDe().text).toContain(`commission sur le resto : ${formaterPrix(com)}`);
    expect(json.texteWhatsApp).not.toMatch(/commission|somme due/i);
  });
  it('le bon du resto montre la commission et la promo qu’il paie, puis ce qu’il reçoit vraiment', async () => {
    const json = await lancer({ commission: { restos: { 'baguette-baguette': 10 } }, promos: [{ id: 'promo1', nom: 'P', type: 'montant', valeur: 2, financeur: 'resto', actif: true }] });
    const com = Math.round(plat.prix * 100) / 1000;
    expect(json.bon.donnees.deductions).toEqual([
      { libelle: 'Commission du livreur', montant: `−${formaterPrix(com)}` },
      { libelle: 'Promo payée par le resto', montant: '−2,000 DT' },
    ]);
    expect(json.bon.donnees.aPayer).toBe(formaterPrix(plat.prix - com - 2));
    expect(json.bon.donnees.sousTotal).toBe(formaterPrix(plat.prix)); // prix bruts toujours sur les lignes
  });
  it('bon sans commission ni promo du resto : aucun retrait', async () => {
    const json = await lancer({});
    expect(json.bon.donnees.deductions).toEqual([]);
    expect(json.bon.donnees.aPayer).toBe(formaterPrix(plat.prix));
  });
  it('anciens réglages de commission (tous, menu, plat) d’une config existante : ignorés', async () => {
    await lancer({ commission: { restos: {}, tous: 7, categories: {}, plats: { 'baguette-baguette': { [plat.id]: 50 } } } });
    expect(mailDe().text).not.toContain('commission sur le resto');
  });
  const promo = (financeur: 'livreur' | 'resto' | 'partage') => ({ promos: [{ id: 'promo1', nom: 'Bienvenue', type: 'montant', valeur: 2, financeur, partResto: financeur === 'partage' ? 50 : undefined, actif: true }] });
  it.each([
    ['livreur', 0, 2],
    ['resto', 2, 0],
    ['partage', 1, 1],
  ] as const)('promo payée par %s : le client paie 2 DT de moins, le livreur et le resto se partagent', async (financeur, partResto, partLivreur) => {
    const json = await lancer(promo(financeur));
    expect(json.total).toBe(Math.round((plat.prix - 2 + 5.5) * 1000) / 1000);
    expect(json.texteWhatsApp).toContain('Promo « Bienvenue » : −2,000 DT');
    const t = mailDe().text;
    expect(t).toContain(`SOMME DUE AU RESTAURANT : ${formaterPrix(plat.prix - partResto)}`);
    expect(t).toContain(`VOTRE GAIN : ${formaterPrix(5.5 - partLivreur)}`);
  });
  it('identité : total = somme due au resto + gain (promo partagée + commission + pourboire + frais de service)', async () => {
    const json = await lancer({ ...promo('partage'), commission: { restos: { 'baguette-baguette': 12.5 } }, fraisService: { pourcent: 8, min: 0.8, max: 5 } });
    const t = mailDe().text;
    const nombre = (re: RegExp) => Number(t.match(re)![1].replace(/\s/g, '').replace(',', '.'));
    expect(nombre(/SOMME DUE AU RESTAURANT : ([\d,]+) DT/) + nombre(/VOTRE GAIN : (-?[\d,]+) DT/)).toBeCloseTo(json.total, 3);
  });
});

describe('pourboire', () => {
  it('ajouté au total, visible du client, dans le gain du livreur', async () => {
    const json = await (await traiterCommande(req({ ...valide, pourboire: 2 }), env, getLivreur(), lire)).json();
    expect(json.total).toBe(Math.round((plat.prix + 5.5 + 2) * 1000) / 1000);
    expect(json.texteWhatsApp).toContain('Pourboire : 2,000 DT');
    const mail = JSON.parse(appels().find(([u]) => String(u).includes('resend'))![1].body);
    expect(mail.text).toContain('pourboire : 2,000 DT');
    expect(mail.text).toContain(`VOTRE GAIN : ${formaterPrix(5.5 + 2)}`);
    expect(mail.html).toContain('Pourboire');
  });
  it('pourboire négatif ou démesuré refusé', async () => {
    expect((await traiterCommande(req({ ...valide, pourboire: -1 }), env, getLivreur(), lire)).status).toBe(400);
    expect((await traiterCommande(req({ ...valide, pourboire: 500 }), env, getLivreur(), lire)).status).toBe(400);
  });
});

describe('majoration du livreur dans la commande', () => {
  const avecMarge = { ...getLivreur(), majoration: { tous: { montant: 2 } } };
  const commanderMarge = async () => (await traiterCommande(req(valide), env, avecMarge, lire)).json();

  it('le client paie le prix majoré ; le message WhatsApp (vu par le client) ne parle pas de majoration', async () => {
    const json = await commanderMarge();
    expect(json.total).toBe(Math.round((plat.prix + 2 + 5.5) * 1000) / 1000);
    expect(json.texteWhatsApp).not.toMatch(/majoration|somme due|payer au resto|prix resto/i);
    expect(json.texteWhatsApp).not.toContain(formaterPrix(plat.prix)); // seul le prix majoré apparaît
  });
  it('l’email montre le prix du resto et la majoration', async () => {
    await commanderMarge();
    const mail = JSON.parse(appels().find(([u]) => String(u).includes('resend'))![1].body);
    expect(mail.text).toContain(`dont prix du resto : ${formaterPrix(plat.prix)}`);
    expect(mail.text).toContain('dont votre majoration : 2,000 DT');
    expect(mail.html).toContain('dont votre majoration');
  });
  it('l’email résume : à encaisser, à payer au resto, gain = livraison + majoration', async () => {
    const json = await commanderMarge();
    const mail = JSON.parse(appels().find(([u]) => String(u).includes('resend'))![1].body);
    expect(mail.text).toContain(`À ENCAISSER du client : ${formaterPrix(json.total)}`);
    expect(mail.text).toContain(`SOMME DUE AU RESTAURANT : ${formaterPrix(plat.prix)}`);
    expect(mail.text).toContain(`VOTRE GAIN : ${formaterPrix(json.total - plat.prix)}`);
    expect(mail.text).toContain('livraison : 5,500 DT');
    expect(mail.text).toContain('majoration : 2,000 DT');
    for (const t of ['À encaisser auprès du client', 'Somme due au restaurant', 'Votre gain']) expect(mail.html).toContain(t);
  });
  it('le bon pour le resto est aux prix du resto', async () => {
    const { bon } = await commanderMarge();
    expect(bon.donnees.lignes[0].prix).toBe(formaterPrix(plat.prix));
    expect(bon.donnees.sousTotal).toBe(formaterPrix(plat.prix));
  });
  it('sans majoration : pas de ligne de marge dans l’email', async () => {
    await commander(valide);
    const mail = JSON.parse(appels().find(([u]) => String(u).includes('resend'))![1].body);
    expect(mail.text).not.toContain('majoration');
  });
});

describe('pause avec heure de retour', () => {
  const CLE = 'cle-du-livreur';
  const envC = () => ({ ...env, CONFIG_CLE: CLE });
  const poster = (champs: Record<string, string>) =>
    pageConfig(
      new Request('https://speedy.test/api/config', {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ cle: CLE, ...champs }).toString(),
      }),
      envC(),
      getLivreur(),
      lire,
      async () => [],
    );
  const etat = async () => (await etatLivreur(new Request('https://speedy.test/api/etat'), envC(), getLivreur())).json();

  it('annonce le retour, puis reprend toute seule à l’heure dite', async () => {
    expect((await poster({ action: 'pause', retour: '2026-11-16T14:30' })).status).toBe(303); // horloge : 12:00
    expect(await etat()).toMatchObject({ pause: true, retour: '2026-11-16T14:30' });
    expect((await (await commander(valide)).json()).erreur).toContain('retour aujourd’hui à 14:30');
    vi.setSystemTime(new Date('2026-11-16T14:31:00+01:00'));
    expect(await etat()).toMatchObject({ pause: false, retour: null });
    expect((await commander(valide)).status).toBe(200);
  });
  it('refuse une heure de retour passée ou mal formée', async () => {
    expect((await poster({ action: 'pause', retour: '2026-11-16T09:00' })).status).toBe(400);
    expect((await poster({ action: 'pause', retour: 'demain' })).status).toBe(400);
    expect((await etat()).pause).toBe(false);
  });
});

describe('colis (POST /api/colis)', () => {
  const pos = resto.position;
  const corps = {
    depart: { adresse: 'Rue Habib Thameur, Sfax', position: pos },
    arrivee: { adresse: 'Route de Tunis km 4, Sfax', position: { lat: pos.lat + 3 / 111.195, lng: pos.lng } },
    taille: 'moyen',
    contenu: 'vêtements',
    client: { nom: 'Sami', telephone: '22123456' },
    destinataire: { telephone: '98765432' },
  };
  const envoyer = (b: unknown, e: Env = env) =>
    traiterColis(new Request('https://speedy.test/api/colis', { method: 'POST', body: JSON.stringify(b) }), e, getLivreur());

  it('envoie l’email au livreur avec le numéro du client, et renvoie l’estimation', async () => {
    const res = await envoyer(corps);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toMatchObject({ km: 3.9, frais: 5.5, email: 'sent', numeroWhatsApp: '21600000000' });
    const mail = JSON.parse(appels().find(([u]) => String(u).includes('resend'))![1].body);
    expect(mail.to).toBe(getLivreur().email);
    expect(mail.subject).toContain(`Colis N° ${json.ref}`);
    expect(mail.subject).toContain('22123456');
    expect(mail.html).toContain('tel:+21622123456');
    expect(mail.html).toContain('APPELER LE CLIENT');
  });
  it('tarif colis à part : réglé par le livreur, appliqué à la demande ; colis fermés = refus', async () => {
    const e = { ...env, BONS: seau() } as Env;
    await e.BONS!.put('config/21600000000.json', JSON.stringify({ colis: { actif: true, base: 2, parKm: 1, min: 3, max: 20, rayonMaxKm: 10, moyen: 1, grand: 2 } }));
    const json = await (await envoyer(corps, e)).json(); // taille « moyen », 3,9 km : 2 + 3,9 = 5,9 → 6, + 1
    expect(json.frais).toBe(7);
    await e.BONS!.put('config/21600000000.json', JSON.stringify({ colis: { actif: false, base: 2, parKm: 1, min: 3, max: 20, rayonMaxKm: 10 } }));
    const ferme = await envoyer(corps, e);
    expect(ferme.status).toBe(400);
    expect((await ferme.json()).erreur).toContain('fermées');
  });
  it('refusé pendant la pause du livreur', async () => {
    await env.BONS!.put('config/21600000000.json', JSON.stringify({ pause: true }));
    const res = await envoyer(corps);
    expect(res.status).toBe(400);
    expect((await res.json()).erreur).toContain('pause');
  });
  it('400 sans repère sur la carte ou avec un numéro invalide', async () => {
    expect((await envoyer({ ...corps, arrivee: { adresse: 'Route de Tunis km 4' } })).status).toBe(400);
    expect((await envoyer({ ...corps, destinataire: { telephone: '123' } })).status).toBe(400);
  });
});

describe('verrou de domaine des POST', () => {
  const post = (url: string, headers: Record<string, string>) => new Request(url, { method: 'POST', headers, body: '{}' });

  it('autreOrigine : même hôte, sans en-tête ou Origin: null same-origin (page config no-referrer) = non ; autre hôte, cross-site ou Origin illisible = oui', () => {
    const u = 'https://speedy.test/api/commande';
    expect(autreOrigine(post(u, {}))).toBe(false);
    expect(autreOrigine(post(u, { origin: 'https://speedy.test' }))).toBe(false);
    expect(autreOrigine(post(u, { 'sec-fetch-site': 'same-origin' }))).toBe(false);
    expect(autreOrigine(post(u, { origin: 'https://copie.com' }))).toBe(true);
    expect(autreOrigine(post(u, { origin: 'null', 'sec-fetch-site': 'same-origin' }))).toBe(false);
    expect(autreOrigine(post(u, { origin: 'null', 'sec-fetch-site': 'cross-site' }))).toBe(true);
    expect(autreOrigine(post(u, { origin: 'not a url' }))).toBe(true);
    expect(autreOrigine(post(u, { 'sec-fetch-site': 'cross-site' }))).toBe(true);
  });

  it('403 sur commande, colis, coupon, bon et config POST depuis un autre domaine, sans toucher à rien', async () => {
    const h = { origin: 'https://copie.com' };
    const appelsAvant = appels().length;
    const reponses = await Promise.all([
      traiterCommande(post('https://speedy.test/api/commande', h), env, getLivreur(), lire),
      traiterColis(post('https://speedy.test/api/colis', h), env, getLivreur()),
      verifierCoupon(post('https://speedy.test/api/coupon', h), env, getLivreur()),
      recevoirBon(post('https://speedy.test/api/bon/REF?sig=x', h), env, 'REF'),
      pageConfig(post('https://speedy.test/api/config', h), env, getLivreur(), lire, async () => []),
    ]);
    expect(reponses.map((r) => r.status)).toEqual([403, 403, 403, 403, 403]);
    expect(appels().length).toBe(appelsAvant);
  });

  it('les GET ouverts par lien (bon, config) ne sont jamais bloqués par l’origine', async () => {
    const res = await pageConfig(new Request('https://speedy.test/api/config?cle=', { headers: { origin: 'https://copie.com' } }), env, getLivreur(), lire, async () => []);
    expect(res.status).toBe(404); // clé absente : refusé pour la clé, pas pour l’origine
  });
});

describe('alertes push du livreur (/api/push)', () => {
  const CLE = 'cle-du-livreur';
  const ENDPOINT = 'https://fcm.googleapis.com/fcm/send/telephone-1';
  let jwk: string;
  beforeEach(async () => {
    const { privateKey } = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign']);
    jwk = JSON.stringify(await crypto.subtle.exportKey('jwk', privateKey));
  });
  const envP = () => ({ ...env, CONFIG_CLE: CLE, VAPID_JWK: jwk });
  const appel = (corps: unknown, e: Env = envP(), cle = CLE, headers: Record<string, string> = {}) =>
    pagePush(new Request(`https://speedy.test/api/push?cle=${cle}`, { method: 'POST', headers, body: JSON.stringify(corps) }), e, getLivreur());
  const pushs = () => appels().filter(([u]) => String(u).startsWith('https://fcm.googleapis.com'));

  it('404 sans la bonne clé, 403 depuis un autre domaine, 400 pour une adresse inconnue', async () => {
    expect((await appel({ endpoint: ENDPOINT }, envP(), 'mauvaise')).status).toBe(404);
    expect((await appel({ endpoint: ENDPOINT }, envP(), CLE, { origin: 'https://copie.com' })).status).toBe(403);
    expect((await appel({ endpoint: 'https://evil.com/x' })).status).toBe(400);
  });

  it('GET : page avec la clé publique ; manifeste pour l’écran d’accueil ; sans VAPID_JWK la page le dit', async () => {
    const page = await (await pagePush(new Request(`https://speedy.test/api/push?cle=${CLE}`), envP(), getLivreur())).text();
    expect(page).toContain('Activer sur ce téléphone');
    expect(page).not.toContain('"d"'); // jamais la clé privée
    expect(page).toContain("typeof Notification!=='undefined'"); // iPhone Safari hors écran d'accueil : pas d'API Notification
    const man = await (await pagePush(new Request(`https://speedy.test/api/push?cle=${CLE}&manifest=1`), envP(), getLivreur())).json();
    expect(man.start_url).toBe(`/api/push?cle=${CLE}`);
    const sans = await (await pagePush(new Request(`https://speedy.test/api/push?cle=${CLE}`), { ...env, CONFIG_CLE: CLE }, getLivreur())).text();
    expect(sans).toContain('var K="cle-du-livreur",PUB=null');
  });

  it('la page de réglages a un lien vers l’activation des alertes, avec la clé', async () => {
    const html = await (await pageConfig(new Request(`https://speedy.test/api/config?cle=${CLE}`), envP(), getLivreur(), async () => null, async () => [])).text();
    expect(html).toContain(`href="/api/push?cle=${CLE}"`);
  });

  it('abonne un téléphone (sans doublon) et une commande lui envoie une alerte', async () => {
    const e = envP();
    expect((await appel({ endpoint: ENDPOINT }, e)).status).toBe(200);
    expect((await appel({ endpoint: ENDPOINT }, e)).status).toBe(200);
    expect(JSON.parse(String(e.BONS!.get && (await new Response((await e.BONS!.get(`push/${getLivreur().whatsapp}.json`))!.body).text())))).toEqual([ENDPOINT]);
    expect((await commander(valide, e)).status).toBe(200);
    expect(pushs()).toHaveLength(1);
  });

  it('la commande part quand même si le service push est en panne ; une adresse morte (410) est retirée', async () => {
    const e = envP();
    await appel({ endpoint: ENDPOINT }, e);
    vi.stubGlobal('fetch', vi.fn(async (u: string) => (String(u).startsWith('https://fcm') ? new Response(null, { status: 410 }) : new Response('{"id":"x"}'))));
    expect((await commander(valide, e)).status).toBe(200);
    const reste = await new Response((await e.BONS!.get(`push/${getLivreur().whatsapp}.json`))!.body).text();
    expect(JSON.parse(reste)).toEqual([]);
  });

  it('le test envoie une alerte et dit combien de téléphones ; sans téléphone abonné : 0', async () => {
    const e = envP();
    expect(await (await appel({ test: true }, e)).json()).toEqual({ ok: true, envoyes: 0 });
    await appel({ endpoint: ENDPOINT }, e);
    expect(await (await appel({ test: true }, e)).json()).toEqual({ ok: true, envoyes: 1 });
  });
});

describe('historique des commandes (/api/commandes)', () => {
  const CLE = 'cle-commandes-test';
  const appeler = (e: Env, init?: { body?: unknown; cle?: string }) =>
    pageCommandes(
      new Request(`https://speedy.test/api/commandes?cle=${init?.cle ?? CLE}`, init?.body ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(init.body) } : undefined),
      e,
      getLivreur(),
    );
  const cles = (e: Env) => [...(e.BONS as ReturnType<typeof seau>).objets.keys()].filter((k) => k.startsWith('commandes/21600000000/'));

  it('chaque commande est enregistrée, apparaît « en cours », puis passe à l’historique quand elle est livrée', async () => {
    const e = { ...env, CONFIG_CLE: CLE };
    const { ref } = await (await commander(valide, e)).json();
    expect(cles(e)).toHaveLength(1);
    let page = await (await appeler(e)).text();
    expect(page).toContain(`N° ${ref}`);
    expect(page).toContain('En cours (1)');
    expect(page).toContain('Historique (0)');
    // Mêmes détails que l’email (gain, somme due au resto, articles, client) et la date en clair (heure de Tunis).
    expect(page).toContain('Votre gain');
    expect(page).toContain('Somme due au restaurant');
    expect(page).toContain('Sami');
    expect(page).toContain('lundi 16 novembre 2026 à 12:00');
    expect(page.match(/<html/g)).toHaveLength(1); // le corps de l’email est inséré, pas le document entier

    const id = cles(e)[0].split('/')[2].replace('.json', '');
    expect((await appeler(e, { body: { id, statut: 'livree' } })).status).toBe(200);
    page = await (await appeler(e)).text();
    expect(page).toContain('En cours (0)');
    expect(page).toContain('Historique (1)');
    expect(page).toContain('✅ Livrée');
    // On peut la remettre en cours.
    await appeler(e, { body: { id, statut: 'nouvelle' } });
    expect(await (await appeler(e)).text()).toContain('En cours (1)');
  });

  it('la page de config a un écran « Commandes » (premier onglet) avec la liste, et le compte sur l’accueil', async () => {
    const e = { ...env, CONFIG_CLE: CLE };
    await commander(valide, e);
    const html = await (await pageConfig(new Request(`https://speedy.test/api/config?cle=${CLE}`), e, getLivreur(), async () => null, async () => [])).text();
    expect(html).toContain('data-vue="commandes"');
    expect(html).toContain('href="#commandes" data-n="commandes"');
    expect(html).toContain('1 en cours');
    // La liste se met à jour toute seule (message du service worker, retour sur l’appli, minuterie) : plus de rechargement à la main.
    expect(html).toContain("e.data.type==='commande'");
    expect(html).toContain('visibilitychange');
    expect(html).toContain('data-id="');
    expect(html).toContain('Votre gain');
    expect(html.indexOf('data-vue="commandes"')).toBeLessThan(html.indexOf('data-vue="accueil"'));
  });

  it('les plus récentes d’abord, un colis aussi est enregistré', async () => {
    const e = { ...env, CONFIG_CLE: CLE };
    await commander(valide, e);
    vi.setSystemTime(new Date('2026-11-16T12:05:00+01:00'));
    await traiterColis(
      new Request('https://speedy.test/api/colis', { method: 'POST', body: JSON.stringify({ depart: { adresse: 'Rue Habib Thameur, Sfax', position: resto.position }, arrivee: { adresse: 'Route de Tunis km 4, Sfax', position }, taille: 'moyen', contenu: 'vêtements', client: { nom: 'Nour', telephone: '22123456' }, destinataire: { telephone: '98765432' } }) }),
      e,
      getLivreur(),
    );
    const l = cles(e);
    expect(l).toHaveLength(2);
    expect([...l].sort()[0]).toBe(l[1]); // la plus récente (le colis) a la plus petite clé
    const page = await (await appeler(e)).text();
    expect(page.indexOf('Colis')).toBeLessThan(page.indexOf('Baguette'));
  });

  it('mauvaise clé = 404, id invalide = 400, fiche inconnue = 404, autre domaine = 403', async () => {
    const e = { ...env, CONFIG_CLE: CLE };
    expect((await appeler(e, { cle: 'mauvaise' })).status).toBe(404);
    expect((await appeler(e, { body: { id: '../config/x', statut: 'livree' } })).status).toBe(400);
    expect((await appeler(e, { body: { id: '1234567890123-ABCDEF', statut: 'livree' } })).status).toBe(404);
    const croisee = await pageCommandes(new Request(`https://speedy.test/api/commandes?cle=${CLE}`, { method: 'POST', headers: { origin: 'https://autre.com' }, body: '{}' }), e, getLivreur());
    expect(croisee.status).toBe(403);
  });

  it('un échec d’écriture dans R2 ne bloque pas la commande', async () => {
    const e = { ...env, CONFIG_CLE: CLE, BONS: { ...seau(), put: async () => { throw new Error('R2 en panne'); } } as SeauR2 };
    expect((await commander(valide, e)).status).toBe(200);
  });
});
