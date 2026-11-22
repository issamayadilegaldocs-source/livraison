import { describe, expect, it } from 'vitest';
import { calculerFraisService, FRAIS_SERVICE_ZIGZAG } from './frais-service';

describe('calculerFraisService (formule Zigzag : 8 %, min 0,8, max 5)', () => {
  const f = FRAIS_SERVICE_ZIGZAG;
  it('sans réglage : 0', () => expect(calculerFraisService(null, 20)).toBe(0));
  it('pourcentage du panier', () => expect(calculerFraisService(f, 12)).toBe(0.96));
  it('minimum', () => expect(calculerFraisService(f, 3.5)).toBe(0.8));
  it('maximum', () => expect(calculerFraisService(f, 100)).toBe(5));
  it('commande réelle Zigzag : 13 DT → 1,04', () => expect(calculerFraisService(f, 13)).toBe(1.04));
});
