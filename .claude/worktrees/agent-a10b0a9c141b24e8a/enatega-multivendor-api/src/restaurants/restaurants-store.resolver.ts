import { Args, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { RestaurantModel } from './restaurant.model';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard';
import { RestaurantsService } from './restaurants.service';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role, JwtUser } from '../auth/roles.enum';
import { CurrentUser } from '../auth/current-user.decorator';

@Resolver(() => RestaurantModel)
@UseGuards(ClerkAuthGuard, RolesGuard)
@Roles(Role.STORE, Role.VENDOR)
export class RestaurantsStoreResolver {
  constructor(
    private readonly restaurantsService: RestaurantsService,
  ) {}

  // Resolves the restaurant for the active per-store Clerk identity. The store
  // app calls this after login to map the signed-in account to its own store.
  @Query(() => RestaurantModel, { name: 'storeProfile' })
  storeProfile(
    @CurrentUser() jwt: JwtUser,
  ) {
    return this.restaurantsService.findByClerkIdOrThrow(jwt.userId);
  }

  @Mutation(() => RestaurantModel, { name: 'toggleStoreAvailability' })
  toggleStoreAvailability(
    @CurrentUser() jwt: JwtUser,
    @Args('pauseMinutes', { type: () => Int, nullable: true }) pauseMinutes?: number,
  ) {
    return this.restaurantsService.toggleAvailability(jwt.userId, pauseMinutes ?? undefined);
  }

  @Mutation(() => RestaurantModel, { name: 'saveRestaurantToken' })
  saveRestaurantToken(
    @CurrentUser() jwt: JwtUser,
    @Args('token', { type: () => String, nullable: true }) token?: string,
    @Args('isEnabled', { type: () => Boolean, nullable: true }) isEnabled?: boolean,
  ) {
    return this.restaurantsService.saveNotificationToken(jwt.userId, token, isEnabled);
  }

}
