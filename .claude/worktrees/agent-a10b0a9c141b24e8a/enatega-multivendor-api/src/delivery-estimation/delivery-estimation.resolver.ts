import { UseGuards } from '@nestjs/common';
import { Args, Query, Resolver } from '@nestjs/graphql';
import { Throttle } from '@nestjs/throttler';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard';
import { DeliveryTimeEstimateArgs } from './dto/delivery-time-estimate.args';
import { DeliveryEstimationService } from './delivery-estimation.service';
import { DeliveryTimeEstimate } from './delivery-estimation.model';

@Resolver()
export class DeliveryEstimationResolver {
  constructor(private readonly service: DeliveryEstimationService) {}

  @Query(() => DeliveryTimeEstimate)
  @UseGuards(ClerkAuthGuard)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  deliveryTimeEstimate(@Args() args: DeliveryTimeEstimateArgs): Promise<DeliveryTimeEstimate> {
    return this.service.estimate(args);
  }
}
