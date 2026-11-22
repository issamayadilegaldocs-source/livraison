import { UseGuards } from '@nestjs/common';
import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { Role, JwtUser } from '../auth/roles.enum';
import { AuditService } from '../audit/audit.service';
import { OfferModel } from './offer.model';
import { OfferInput } from './dto/offer.input';
import { OffersService } from './offers.service';

@Resolver(() => OfferModel)
@UseGuards(ClerkAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class OffersAdminResolver {
  constructor(
    private readonly offersService: OffersService,
    private readonly auditService: AuditService,
  ) {}

  @Query(() => [OfferModel], { name: 'offers' })
  offers() {
    return this.offersService.findAll();
  }

  @Query(() => [OfferModel], { name: 'restaurantOffers' })
  restaurantOffers(
    @Args('restaurantId', { type: () => ID }) restaurantId: string,
  ) {
    return this.offersService.findByRestaurant(restaurantId);
  }

  @Mutation(() => OfferModel, { name: 'adminCreateOffer' })
  async adminCreateOffer(
    @CurrentUser() jwt: JwtUser,
    @Args('restaurantId', { type: () => ID }) restaurantId: string,
    @Args('offerInput') offerInput: OfferInput,
  ) {
    const result = await this.offersService.createOffer(
      { restaurantId },
      offerInput,
    );
    this.auditService
      .create(jwt.userId, jwt.userId, 'CREATE_OFFER', 'Offer', String(result._id))
      .catch(() => undefined);
    return result;
  }

  @Mutation(() => OfferModel, { name: 'adminEditOffer' })
  async adminEditOffer(
    @CurrentUser() jwt: JwtUser,
    @Args('restaurantId', { type: () => ID }) restaurantId: string,
    @Args('offerInput') offerInput: OfferInput,
  ) {
    const result = await this.offersService.editOffer({ restaurantId }, offerInput);
    this.auditService
      .create(jwt.userId, jwt.userId, 'EDIT_OFFER', 'Offer', String(offerInput._id))
      .catch(() => undefined);
    return result;
  }

  @Mutation(() => OfferModel, { name: 'moderateOffer' })
  async moderateOffer(
    @CurrentUser() jwt: JwtUser,
    @Args('id', { type: () => ID }) id: string,
    @Args('enabled', { type: () => Boolean }) enabled: boolean,
  ) {
    const result = await this.offersService.moderateOffer(id, enabled);
    this.auditService
      .create(
        jwt.userId,
        jwt.userId,
        enabled ? 'ENABLE_OFFER' : 'DISABLE_OFFER',
        'Offer',
        id,
      )
      .catch(() => undefined);
    return result;
  }

  @Mutation(() => Boolean, { name: 'deleteOffer' })
  async deleteOffer(
    @CurrentUser() jwt: JwtUser,
    @Args('id', { type: () => ID }) id: string,
  ) {
    const result = await this.offersService.deleteOffer(id);
    this.auditService
      .create(jwt.userId, jwt.userId, 'DELETE_OFFER', 'Offer', id)
      .catch(() => undefined);
    return result;
  }
}
