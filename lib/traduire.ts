// Traduction FR → AR sans React : utilisable dans lib/ (pur) comme dans les composants.
// La clé est le texte français lui-même ; `{x}` marque une valeur variable. Texte absent du dictionnaire = français.
export type Tr = (fr: string, v?: Record<string, string | number>) => string;

export const remplir: Tr = (s, v) => (v ? s.replace(/\{(\w+)\}/g, (_, k) => String(v[k] ?? '')) : s);

export const traducteur =
  (dico: Record<string, string> | null): Tr =>
  (fr, v) =>
    remplir(dico?.[fr] ?? fr, v);
