import { UseGuards } from '@nestjs/common';
import { Args, ID, Int, Query, Resolver } from '@nestjs/graphql';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '../auth/roles.enum';
import { ReassignmentImpactModel, RiderSuggestionModel } from './dispatch.model';
import { DispatchService } from './dispatch.service';

/**
 * Admin-only smart-dispatch decision support: these two queries only inform
 * a reassignment decision. The frontend executes the actual reassignment via
 * the existing `assignRider` mutation (orders module) — no new assignment
 * mutation is added here.
 */
@UseGuards(ClerkAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Resolver()
export class DispatchResolver {
  constructor(private readonly dispatchService: DispatchService) {}

  @Query(() => [RiderSuggestionModel], { name: 'suggestRidersForOrder' })
  suggestRidersForOrder(
    @Args('orderId', { type: () => ID }) orderId: string,
    @Args('limit', { type: () => Int, nullable: true }) limit?: number,
  ) {
    return this.dispatchService.suggestRidersForOrder(orderId, limit ?? 10);
  }

  @Query(() => ReassignmentImpactModel, { name: 'estimateReassignmentImpact' })
  estimateReassignmentImpact(
    @Args('orderId', { type: () => ID }) orderId: string,
    @Args('candidateRiderId', { type: () => ID }) candidateRiderId: string,
  ) {
    return this.dispatchService.estimateReassignmentImpact(orderId, candidateRiderId);
  }
}
