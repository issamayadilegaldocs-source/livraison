import { UseGuards } from '@nestjs/common';
import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { Role, JwtUser } from '../auth/roles.enum';
import { IdempotencyKey } from '../common/idempotency-key.decorator';
import { OfferModel } from './offer.model';
import { OfferInput } from './dto/offer.input';
import { OffersService } from './offers.service';

@Resolver(() => OfferModel)
@UseGuards(ClerkAuthGuard, RolesGuard)
@Roles(Role.STORE, Role.VENDOR)
export class OffersStoreResolver {
  constructor(private readonly offersService: OffersService) {}

  @Query(() => [OfferModel], { name: 'myOffers' })
  myOffers(@CurrentUser() jwt: JwtUser) {
    return this.offersService.myOffers(jwt.userId);
  }

  @Mutation(() => OfferModel, { name: 'createOffer' })
  createOffer(
    @CurrentUser() jwt: JwtUser,
    @Args('offerInput') offerInput: OfferInput,
    @IdempotencyKey() idempotencyKey?: string,
  ) {
    return this.offersService.createOffer(
      { clerkId: jwt.userId },
      offerInput,
      idempotencyKey,
    );
  }

  @Mutation(() => OfferModel, { name: 'editOffer' })
  editOffer(
    @CurrentUser() jwt: JwtUser,
    @Args('offerInput') offerInput: OfferInput,
  ) {
    return this.offersService.editOffer({ clerkId: jwt.userId }, offerInput);
  }

  @Mutation(() => Boolean, { name: 'cancelOffer' })
  cancelOffer(
    @CurrentUser() jwt: JwtUser,
    @Args('id', { type: () => ID }) id: string,
  ) {
    return this.offersService.cancelOffer(jwt.userId, id);
  }
}
