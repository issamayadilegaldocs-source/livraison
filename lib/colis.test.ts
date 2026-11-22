import { describe, expect, it } from 'vitest';
import { calculerColis, ColisConfSchema, ColisSchema, messageColis, tarifColis } from './colis';

const repas = { base: 1, parKm: 0.5, min: 1, max: 12, rayonMaxKm: 15, facteurRoute: 1.3 };
const conf = tarifColis(repas, undefined); // sans règle : mêmes frais que les repas
const depart = { lat: 34.74, lng: 10.76 };
const nordDe = (km: number) => ({ lat: 34.74 + km / 111.195, lng: 10.76 });
const demande = (km = 3) =>
  ColisSchema.parse({
    depart: { adresse: 'Rue Habib Thameur', position: depart },
    arrivee: { adresse: 'Route de Tunis km 4', position: nordDe(km) },
    taille: 'petit',
    contenu: 'documents',
    client: { nom: 'Sami', telephone: '22 123 456' },
    destinataire: { nom: 'Mouna', telephone: '98765432' },
  });

describe('calculerColis', () => {
  it('estime avec les frais du livreur et normalise les numéros', () => {
    const c = calculerColis(conf, demande(3));
    expect(c).toMatchObject({ km: 3.9, frais: 3, client: { telephone: '21622123456' }, destinataire: { telephone: '21698765432' } });
  });
  it('refuse un numéro invalide et une distance hors rayon', () => {
    expect(calculerColis(conf, { ...demande(), client: { nom: 'Sami', telephone: '123' } })).toEqual({ erreur: expect.stringContaining('numéro') });
    expect(calculerColis(conf, demande(14))).toEqual({ erreur: expect.stringContaining('point de ramassage') });
  });
  it('le schéma exige des adresses placées sur la carte', () => {
    expect(ColisSchema.safeParse({ ...demande(), depart: { adresse: 'Rue Habib Thameur' } }).success).toBe(false);
  });
  it('le texte de l’email commence par le client à appeler', () => {
    const c = calculerColis(conf, demande(3));
    if ('erreur' in c) throw new Error(c.erreur);
    const t = messageColis(c, 'K7Q2MD', 'Speedy');
    expect(t.split('\n')[2]).toBe('À FAIRE : appeler le client Sami au +216 22 123 456');
    expect(t).toContain('Destinataire : Mouna, +216 98 765 432');
    expect(t).toContain('prix estimé 3,000 DT');
  });
});

describe('tarif colis à part (règle du livreur)', () => {
  const regle = ColisConfSchema.parse({ base: 2, parKm: 1, min: 3, max: 20, rayonMaxKm: 10, moyen: 1, grand: 2.5 });
  const tarif = tarifColis(repas, regle);
  const petit = (km: number) => demande(km);
  const avecTaille = (taille: 'petit' | 'moyen' | 'grand') => ({ ...demande(3), taille });
  it('prix propre aux colis, indépendant de la livraison des repas', () => {
    expect(calculerColis(tarif, avecTaille('petit'))).toMatchObject({ km: 3.9, frais: 6, supplement: 0 }); // 2 + 1 × 3,9 = 5,9 → 6
    expect(calculerColis(conf, avecTaille('petit'))).toMatchObject({ frais: 3 }); // repas : 1 + 0,5 × 3,9
  });
  it('supplément selon la taille', () => {
    expect(calculerColis(tarif, avecTaille('moyen'))).toMatchObject({ frais: 7, supplement: 1 });
    expect(calculerColis(tarif, avecTaille('grand'))).toMatchObject({ frais: 8.5, supplement: 2.5 });
  });
  it('distance maximale propre aux colis', () => {
    expect(calculerColis(tarif, petit(9))).toEqual({ erreur: expect.stringContaining('point de ramassage') }); // 9 km × 1,3 > 10
  });
  it('colis fermés : demande refusée', () => {
    expect(calculerColis(tarifColis(repas, { ...regle, actif: false }), avecTaille('petit'))).toEqual({ erreur: expect.stringContaining('fermées') });
  });
  it('le texte de l’email détaille le prix', () => {
    const c = calculerColis(tarif, avecTaille('grand'));
    if ('erreur' in c) throw new Error(c.erreur);
    expect(messageColis(c, 'K7Q2MD', 'Speedy')).toContain('(distance 6,000 DT + taille 2,500 DT)');
  });
});

describe('colis urgent et de nuit', () => {
  const regle = ColisConfSchema.parse({ base: 2, parKm: 1, min: 3, max: 20, rayonMaxKm: 10, urgent: 1.5, nuit: { actif: true, de: '22:00', a: '06:00', montant: 2 } });
  const tarif = tarifColis(repas, regle);
  const tunis = (hhmm: string) => new Date(`2026-11-19T${hhmm}:00+01:00`);
  const demandeA = (heure?: string) => ({ ...demande(3), ...(heure && { heure }) });

  it('urgent : seulement sans heure choisie', () => {
    expect(calculerColis(tarif, demandeA(), tunis('12:00'))).toMatchObject({ frais: 7.5, supplements: { urgent: 1.5, nuit: 0 } }); // 6 + 1,5
    expect(calculerColis(tarif, demandeA('15:00'), tunis('12:00'))).toMatchObject({ frais: 6, supplements: { urgent: 0, nuit: 0 } });
  });
  it('nuit : selon l’heure de ramassage choisie, sinon l’heure actuelle', () => {
    expect(calculerColis(tarif, demandeA('23:00'), tunis('12:00'))).toMatchObject({ frais: 8, supplements: { urgent: 0, nuit: 2 } });
    expect(calculerColis(tarif, demandeA(), tunis('23:30'))).toMatchObject({ frais: 9.5, supplements: { urgent: 1.5, nuit: 2 } }); // urgent + nuit
  });
  it('nuit éteinte ou absente : jamais de supplément de nuit', () => {
    expect(calculerColis(tarifColis(repas, { ...regle, nuit: { actif: false, de: '22:00', a: '06:00', montant: 2 } }), demandeA('23:00'))).toMatchObject({ supplements: { nuit: 0 } });
    expect(calculerColis(conf, demandeA('23:00'))).toMatchObject({ supplements: { urgent: 0, nuit: 0 } });
  });
  it('le texte de l’email détaille urgent et nuit', () => {
    const c = calculerColis(tarif, demandeA(), tunis('23:30'));
    if ('erreur' in c) throw new Error(c.erreur);
    const t = messageColis(c, 'K7Q2MD', 'Speedy');
    expect(t).toContain('+ urgent 1,500 DT');
    expect(t).toContain('+ nuit 2,000 DT');
  });
});

