// Messages d'erreur affichés sous les champs du formulaire de commande (null = champ valide).
import { normaliserTelephone } from './commande';
import { remplir, type Tr } from './traduire';

export function erreurNom(nom: string, t: Tr = remplir): string | null {
  const n = nom.trim();
  if (!n) return t('Le nom est obligatoire.');
  if (n.length < 2) return t('Nom trop court (2 lettres minimum).');
  return null;
}

/** Numéro tunisien : 8 chiffres commençant par 2 à 9 (indicatif +216 accepté). */
export function erreurTelephone(tel: string, t: Tr = remplir): string | null {
  const brut = tel.trim();
  if (!brut) return t('Le téléphone est obligatoire : le livreur vous appelle pour confirmer.');
  if (/[^\d\s+().-]/.test(brut)) return t('Seulement des chiffres (ex. 22 123 456).');
  const n = normaliserTelephone(brut);
  if (!n) {
    const chiffres = brut.replace(/\D/g, '').replace(/^(00)?216/, '');
    return chiffres.length < 8 ? t(8 - chiffres.length > 1 ? 'Il manque {n} chiffres (8 chiffres).' : 'Il manque {n} chiffre (8 chiffres).', { n: 8 - chiffres.length }) : t('Numéro trop long : 8 chiffres attendus.');
  }
  if (!/^216[2-9]/.test(n)) return t('Numéro tunisien invalide (il commence par 2, 3, 4, 5, 7 ou 9).');
  return null;
}

export function erreurAdresse(adresse: string, t: Tr = remplir): string | null {
  const a = adresse.trim();
  if (!a) return t('Précisez l’adresse : rue, immeuble, étage.');
  if (a.length < 5) return t('Adresse trop courte : ajoutez la rue ou un repère.');
  return null;
}
