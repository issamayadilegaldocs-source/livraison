import { describe, expect, it } from 'vitest';
import { correctionsClient, corrigerPlats, lireConfig, majorer, pauseEnCours, prixClients, reglages } from './config';
import { getLivreur } from './livreur';

describe('majorer', () => {
  it('sans majoration : prix inchangé', () => expect(majorer(12.5, 0)).toBe(12.5));
  it('arrondi aux 100 millimes supérieurs', () => {
    expect(majorer(12.5, 10)).toBe(13.8); // 13,75 → 13,8
    expect(majorer(10, 10)).toBe(11);
    expect(majorer(7.2, 15)).toBe(8.3); // 8,28 → 8,3
  });
});

describe('corrigerPlats', () => {
  const plats = [
    { id: 1, prix: 10, prixOrigine: 12 },
    { id: 2, prix: 5, prixOrigine: null },
    { id: 3, prix: 8, prixOrigine: null },
  ];
  it('remplace le prix (sans prix barré) et retire les plats indisponibles', () => {
    expect(corrigerPlats(plats, { 1: { prix: 11 }, 3: { indispo: true } })).toEqual([
      { id: 1, prix: 11, prixOrigine: null },
      { id: 2, prix: 5, prixOrigine: null },
    ]);
  });
  it('sans corrections : mêmes plats', () => expect(corrigerPlats(plats, undefined)).toBe(plats));
});

describe('reglages / lireConfig', () => {
  const l = { ...getLivreur(), service: { ouvre: '11:00', ferme: '23:00' } };
  it('config vide : réglages de livreur.json', () => {
    expect(reglages(l, lireConfig(null))).toEqual({ restosFermes: [], commandeMin: null, supplement: null, annonce: null, pourboires: [1, 2, 3, 5], fraisService: null, livraisonGratuite: null, colis: { actif: true, livraison: l.livraison, supplements: { petit: 0, moyen: 0, grand: 0 }, urgent: 0, nuit: null }, commission: undefined, majoration: l.majoration, logoUrl: null, promos: [], service: l.service, livraison: l.livraison });
  });
  it('config avec majoration et logoUrl : pris en compte en direct', () => {
    const r = reglages(l, lireConfig({ majoration: { tous: { pourcent: 10 } }, logoUrl: 'https://example.com/logo.png' }));
    expect(r.majoration).toEqual({ tous: { pourcent: 10 } });
    expect(r.logoUrl).toBe('https://example.com/logo.png');
  });
  it('null = plus d’horaires ; frais du livreur fusionnés (facteurRoute gardé)', () => {
    const r = reglages(l, lireConfig({ service: null, frais: { base: 1, parKm: 0.5, min: 1, max: 12, rayonMaxKm: 15 } }));
    expect(r.service).toBeUndefined();
    expect(r.livraison).toEqual({ ...l.livraison, base: 1, parKm: 0.5, min: 1, max: 12, rayonMaxKm: 15 });
  });
  it('config abîmée dans R2 : ignorée (le site reste sur livreur.json)', () => {
    expect(lireConfig({ pause: 'oui', plats: 3 })).toEqual({ pause: false, plats: {}, restosFermes: [] });
  });
});

describe('prixClients (majoration du livreur)', () => {
  const plat = (id: number, prix: number, supplement = 1) => ({
    id,
    prix,
    prixOrigine: null as number | null,
    groupes: [{ nom: 'Suppl.', type: 'multi' as const, obligatoire: false, min: 0, max: 1, options: [{ label: 'Fromage', prix: supplement }] }],
  });
  const plats = [plat(1, 10), plat(2, 20)];

  it('sans majoration : prix du resto, gardé dans prixResto', () => {
    const [p] = prixClients(plats, undefined, 'r');
    expect(p).toMatchObject({ prix: 10, prixResto: 10 });
    expect(p.groupes[0].options[0]).toMatchObject({ prix: 1, prixResto: 1 });
  });
  it('montant pour tous : ajouté au plat, pas aux suppléments', () => {
    const [p] = prixClients(plats, { tous: { montant: 2 } }, 'r');
    expect(p).toMatchObject({ prix: 12, prixResto: 10 });
    expect(p.groupes[0].options[0].prix).toBe(1);
  });
  it('pourcentage : plat et suppléments', () => {
    const [p] = prixClients(plats, { tous: { pourcent: 10 } }, 'r');
    expect(p.prix).toBe(11);
    expect(p.groupes[0].options[0].prix).toBe(1.1);
  });
  it('priorité : plat > resto > tous', () => {
    const m = { tous: { montant: 1 }, restos: { r: { montant: 3 } }, plats: { 2: { montant: 5 } } };
    expect(prixClients(plats, m, 'r').map((p) => p.prix)).toEqual([13, 25]);
    expect(prixClients(plats, m, 'autre').map((p) => p.prix)).toEqual([11, 25]);
  });
  it('prix client fixé par le livreur : le prix du resto reste celui du menu, pas de règle en plus ; indisponible retiré', () => {
    const r = prixClients(plats, { tous: { montant: 2 } }, 'r', { 1: { prix: 15 }, 2: { indispo: true } });
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ prix: 15, prixResto: 10, prixOrigine: null });
  });
});

describe('prix du resto corrigé par le livreur', () => {
  const plat = { id: 1, prix: 10, prixOrigine: null as number | null, groupes: [] };
  it('nouveau prix du resto, sans prix client fixé : resto + majoration', () => {
    const [p] = prixClients([plat], { tous: { montant: 2 } }, 'r', { 1: { resto: 12 } });
    expect(p).toMatchObject({ prix: 14, prixResto: 12, prixOrigine: null });
  });
  it('prix client fixé : il l’emporte, le prix du resto reste le nouveau', () => {
    const [p] = prixClients([plat], { tous: { montant: 2 } }, 'r', { 1: { resto: 12, prix: 20 } });
    expect(p).toMatchObject({ prix: 20, prixResto: 12 });
  });
  it('le navigateur ne voit jamais le prix du resto', () => {
    const vu = correctionsClient({ tous: { montant: 2 } }, 'r', { 1: { resto: 12 }, 2: { resto: 5, prix: 9 }, 3: { indispo: true } });
    expect(vu).toEqual({ 1: { prix: 14 }, 2: { prix: 9 }, 3: { indispo: true } });
    expect(JSON.stringify(vu)).not.toContain('resto');
  });
});

describe('pauseEnCours', () => {
  const a = (iso: string) => new Date(`${iso}:00+01:00`);
  it('pause sans heure de retour : jusqu’à reprise manuelle', () => expect(pauseEnCours({ pause: true }, a('2026-11-18T23:00'))).toBe(true));
  it('s’arrête toute seule à l’heure de retour', () => {
    const c = { pause: true, retour: '2026-11-18T14:30' };
    expect(pauseEnCours(c, a('2026-11-18T14:29'))).toBe(true);
    expect(pauseEnCours(c, a('2026-11-18T14:30'))).toBe(false);
  });
});
