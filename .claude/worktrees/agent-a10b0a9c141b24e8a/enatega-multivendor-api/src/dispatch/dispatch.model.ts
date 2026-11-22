import { Field, Float, ID, ObjectType } from '@nestjs/graphql';

@ObjectType('RiderSuggestion')
export class RiderSuggestionModel {
  @Field(() => ID) riderId!: string;
  @Field({ nullable: true }) name?: string;
  @Field({ nullable: true }) phone?: string;
  @Field({ nullable: true }) vehicleType?: string;
  /** 0-100, higher is a better dispatch candidate. */
  @Field(() => Float) score!: number;
  @Field(() => Float) distanceKm!: number;
  /** Traffic-aware ETA to the restaurant when available; straight-line-only when the routing provider fails/is unset. */
  @Field(() => Float, { nullable: true }) etaMinutes?: number;
  /** Human-readable factor breakdown, e.g. "Très proche (0.8km)", "Taux d'acceptation 96%". */
  @Field(() => [String]) reasons!: string[];
}

@ObjectType('ReassignmentImpact')
export class ReassignmentImpactModel {
  @Field(() => ID) orderId!: string;
  @Field(() => ID, { nullable: true }) currentRiderId?: string;
  @Field(() => ID) candidateRiderId!: string;
  @Field(() => Float, { nullable: true }) etaBeforeMinutes?: number;
  @Field(() => Float, { nullable: true }) etaAfterMinutes?: number;
  @Field(() => Float, { nullable: true }) distanceSavedKm?: number;
}
