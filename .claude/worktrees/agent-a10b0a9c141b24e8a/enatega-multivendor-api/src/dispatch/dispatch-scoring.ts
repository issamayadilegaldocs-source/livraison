/**
 * Pure, unit-testable smart-dispatch scoring. No I/O — callers (DispatchService)
 * resolve distance/load/acceptance/rejection/zone inputs from Tracking/Riders/
 * Restaurants and pass them in here.
 */
export interface RiderCandidateInput {
  riderId: string;
  /** Straight-line (or, upstream, traffic-refined) distance to the restaurant. */
  distanceKm: number;
  /** Whether the rider currently has an active order assigned (`rider.assigned`). */
  hasActiveOrder: boolean;
  /** accepted / (accepted + rejected) × 100; undefined when the rider has no assignment history yet. */
  acceptanceRatePct?: number;
  /** Cumulative rejected-assignment count (rider.rejectedAssignmentsCount). */
  recentRejectedCount: number;
  /** Whether the rider's home zone matches the order's zone. */
  sameZone: boolean;
}

export interface ScoredRiderCandidate {
  riderId: string;
  /** 0-100 weighted score, higher is a better dispatch candidate. */
  score: number;
  /** Human-readable factor breakdown, e.g. "Très proche (0.8km)". */
  reasons: string[];
}

/** Point budget per factor; sums to 100 at the best possible score. */
const WEIGHTS = {
  distance: 40,
  load: 25,
  acceptance: 20,
  rejection: 10,
  zone: 5,
};

/** Distance (km) beyond which the distance factor contributes 0 points. */
const DISTANCE_DECAY_KM = 10;
/** Rejection count beyond which the rejection factor contributes 0 points. */
const REJECTION_DECAY_COUNT = 5;
/** Acceptance rate assumed for a rider with no assignment history yet (neutral, not punitive). */
const NEUTRAL_ACCEPTANCE_RATE_PCT = 50;

/**
 * 0-100 weighted score for how good a dispatch candidate a rider is for a
 * given order, plus a human-readable reason list for the dispatcher.
 */
export function scoreRiderCandidate(input: RiderCandidateInput): ScoredRiderCandidate {
  const reasons: string[] = [];
  let score = 0;

  const distanceKm = Math.max(0, input.distanceKm);
  const distanceScore = Math.max(0, 1 - distanceKm / DISTANCE_DECAY_KM);
  score += distanceScore * WEIGHTS.distance;
  if (distanceKm <= 1) reasons.push(`Très proche (${distanceKm.toFixed(1)}km)`);
  else if (distanceKm <= 3) reasons.push(`Proche (${distanceKm.toFixed(1)}km)`);
  else reasons.push(`À ${distanceKm.toFixed(1)}km`);

  if (!input.hasActiveOrder) {
    score += WEIGHTS.load;
    reasons.push('Aucune commande en cours');
  } else {
    reasons.push('A déjà une commande en cours');
  }

  const acceptancePct = input.acceptanceRatePct ?? NEUTRAL_ACCEPTANCE_RATE_PCT;
  score += (Math.min(100, Math.max(0, acceptancePct)) / 100) * WEIGHTS.acceptance;
  if (input.acceptanceRatePct !== undefined) {
    reasons.push(`Taux d'acceptation ${Math.round(input.acceptanceRatePct)}%`);
  }

  const rejectionPenalty = Math.min(1, Math.max(0, input.recentRejectedCount) / REJECTION_DECAY_COUNT);
  score += (1 - rejectionPenalty) * WEIGHTS.rejection;
  if (input.recentRejectedCount > 0) {
    reasons.push(`${input.recentRejectedCount} refus au total`);
  }

  if (input.sameZone) {
    score += WEIGHTS.zone;
    reasons.push('Même zone que le restaurant');
  }

  return {
    riderId: input.riderId,
    score: Math.round(Math.min(100, Math.max(0, score))),
    reasons,
  };
}
