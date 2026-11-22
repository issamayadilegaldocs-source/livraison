import { scoreRiderCandidate } from './dispatch-scoring';

describe('scoreRiderCandidate', () => {
  it('gives a near-perfect score to a close, free, high-acceptance, same-zone rider', () => {
    const result = scoreRiderCandidate({
      riderId: 'r1',
      distanceKm: 0.2,
      hasActiveOrder: false,
      acceptanceRatePct: 100,
      recentRejectedCount: 0,
      sameZone: true,
    });
    expect(result.score).toBeGreaterThanOrEqual(95);
    expect(result.reasons).toContain('Très proche (0.2km)');
    expect(result.reasons).toContain('Aucune commande en cours');
    expect(result.reasons).toContain("Taux d'acceptation 100%");
    expect(result.reasons).toContain('Même zone que le restaurant');
  });

  it('scores a far, busy, low-acceptance, out-of-zone rider much lower', () => {
    const result = scoreRiderCandidate({
      riderId: 'r2',
      distanceKm: 12,
      hasActiveOrder: true,
      acceptanceRatePct: 10,
      recentRejectedCount: 6,
      sameZone: false,
    });
    expect(result.score).toBeLessThan(20);
    expect(result.reasons).toContain('A déjà une commande en cours');
  });

  it('never returns a negative score or a score above 100 at the extremes', () => {
    const worst = scoreRiderCandidate({
      riderId: 'r3',
      distanceKm: 999,
      hasActiveOrder: true,
      acceptanceRatePct: 0,
      recentRejectedCount: 999,
      sameZone: false,
    });
    expect(worst.score).toBeGreaterThanOrEqual(0);

    const best = scoreRiderCandidate({
      riderId: 'r4',
      distanceKm: 0,
      hasActiveOrder: false,
      acceptanceRatePct: 100,
      recentRejectedCount: 0,
      sameZone: true,
    });
    expect(best.score).toBeLessThanOrEqual(100);
  });

  it('treats an unknown acceptance history as neutral (50%), not punitive nor a free pass', () => {
    const withHistory60 = scoreRiderCandidate({
      riderId: 'r5',
      distanceKm: 2,
      hasActiveOrder: false,
      acceptanceRatePct: 60,
      recentRejectedCount: 0,
      sameZone: false,
    });
    const noHistory = scoreRiderCandidate({
      riderId: 'r6',
      distanceKm: 2,
      hasActiveOrder: false,
      acceptanceRatePct: undefined,
      recentRejectedCount: 0,
      sameZone: false,
    });
    const withHistory40 = scoreRiderCandidate({
      riderId: 'r7',
      distanceKm: 2,
      hasActiveOrder: false,
      acceptanceRatePct: 40,
      recentRejectedCount: 0,
      sameZone: false,
    });
    expect(noHistory.score).toBeLessThan(withHistory60.score);
    expect(noHistory.score).toBeGreaterThan(withHistory40.score);
    // No acceptance-rate reason line is added when history is absent.
    expect(noHistory.reasons.some((r) => r.includes("Taux d'acceptation"))).toBe(false);
  });

  it('is monotonic in distance: closer never scores worse, all else equal', () => {
    const near = scoreRiderCandidate({
      riderId: 'r8',
      distanceKm: 1,
      hasActiveOrder: false,
      acceptanceRatePct: 80,
      recentRejectedCount: 0,
      sameZone: false,
    });
    const far = scoreRiderCandidate({
      riderId: 'r9',
      distanceKm: 8,
      hasActiveOrder: false,
      acceptanceRatePct: 80,
      recentRejectedCount: 0,
      sameZone: false,
    });
    expect(near.score).toBeGreaterThan(far.score);
  });
});
