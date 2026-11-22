import { Args, ID, Query, Resolver } from '@nestjs/graphql';
import { OfferModel } from './offer.model';
import { OffersService } from './offers.service';

/** Public, customer-facing: only currently-active offers for a restaurant. */
@Resolver(() => OfferModel)
export class OffersResolver {
  constructor(private readonly offersService: OffersService) {}

  @Query(() => [OfferModel], { name: 'activeRestaurantOffers' })
  activeRestaurantOffers(
    @Args('restaurantId', { type: () => ID }) restaurantId: string,
  ) {
    return this.offersService.activeRestaurantOffers(restaurantId);
  }
}
