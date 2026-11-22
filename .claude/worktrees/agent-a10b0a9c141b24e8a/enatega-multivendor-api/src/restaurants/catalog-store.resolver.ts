import { Args, ID, Mutation, Resolver } from '@nestjs/graphql';
import { NotFoundException, UseGuards } from '@nestjs/common';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role, JwtUser } from '../auth/roles.enum';
import { CurrentUser } from '../auth/current-user.decorator';
import { RestaurantModel } from './restaurant.model';
import { CatalogService } from './catalog.service';
import { RestaurantsService } from './restaurants.service';
import {
  CategoryInput,
  FoodInput,
  AddonInput,
  EditAddonInput,
  CreateOptionInput,
  EditOptionInput,
} from './dto/catalog.input';
import { RestaurantProfileInput } from './dto/restaurant.input';

@Resolver(() => RestaurantModel)
@UseGuards(ClerkAuthGuard, RolesGuard)
@Roles(Role.STORE, Role.VENDOR)
export class CatalogStoreResolver {
  constructor(
    private readonly catalogService: CatalogService,
    private readonly restaurantsService: RestaurantsService,
  ) {}

  private async resolveOwnedRestaurantId(clerkId: string): Promise<string> {
    const restaurant = await this.restaurantsService.findByClerkId(clerkId);
    if (!restaurant) throw new NotFoundException('Restaurant not found for this account');
    return String((restaurant as any)._id);
  }

  // ── Categories ─────────────────────────────────────────────────────────────

  @Mutation(() => RestaurantModel, { name: 'storCreateCategory' })
  async storCreateCategory(
    @CurrentUser() jwt: JwtUser,
    @Args('category') input: CategoryInput,
  ) {
    const restaurantId = await this.resolveOwnedRestaurantId(jwt.userId);
    return this.catalogService.createCategory({ ...input, restaurant: restaurantId });
  }

  @Mutation(() => RestaurantModel, { name: 'storEditCategory' })
  async storEditCategory(
    @CurrentUser() jwt: JwtUser,
    @Args('category') input: CategoryInput,
  ) {
    const restaurantId = await this.resolveOwnedRestaurantId(jwt.userId);
    return this.catalogService.editCategory({ ...input, restaurant: restaurantId });
  }

  @Mutation(() => RestaurantModel, { name: 'storDeleteCategory' })
  async storDeleteCategory(
    @CurrentUser() jwt: JwtUser,
    @Args('id', { type: () => ID }) id: string,
  ) {
    const restaurantId = await this.resolveOwnedRestaurantId(jwt.userId);
    return this.catalogService.deleteCategory(id, restaurantId);
  }

  // ── Foods ──────────────────────────────────────────────────────────────────

  @Mutation(() => RestaurantModel, { name: 'storCreateFood' })
  async storCreateFood(
    @CurrentUser() jwt: JwtUser,
    @Args('food') input: FoodInput,
  ) {
    const restaurantId = await this.resolveOwnedRestaurantId(jwt.userId);
    return this.catalogService.createFood({ ...input, restaurant: restaurantId });
  }

  @Mutation(() => RestaurantModel, { name: 'storEditFood' })
  async storEditFood(
    @CurrentUser() jwt: JwtUser,
    @Args('food') input: FoodInput,
  ) {
    const restaurantId = await this.resolveOwnedRestaurantId(jwt.userId);
    return this.catalogService.editFood({ ...input, restaurant: restaurantId });
  }

  @Mutation(() => RestaurantModel, { name: 'storDeleteFood' })
  async storDeleteFood(
    @CurrentUser() jwt: JwtUser,
    @Args('id', { type: () => ID }) id: string,
    @Args('categoryId', { type: () => ID }) categoryId: string,
  ) {
    const restaurantId = await this.resolveOwnedRestaurantId(jwt.userId);
    return this.catalogService.deleteFood(id, restaurantId, categoryId);
  }

  @Mutation(() => Boolean, { name: 'storUpdateFoodOutOfStock' })
  async storUpdateFoodOutOfStock(
    @CurrentUser() jwt: JwtUser,
    @Args('id', { type: () => ID }) id: string,
    @Args('categoryId', { type: () => ID }) categoryId: string,
  ) {
    const restaurantId = await this.resolveOwnedRestaurantId(jwt.userId);
    return this.catalogService.updateFoodOutOfStock(id, restaurantId, categoryId);
  }

  // ── Options ────────────────────────────────────────────────────────────────

  @Mutation(() => RestaurantModel, { name: 'storCreateOptions' })
  async storCreateOptions(
    @CurrentUser() jwt: JwtUser,
    @Args('options') input: CreateOptionInput,
  ) {
    const restaurantId = await this.resolveOwnedRestaurantId(jwt.userId);
    return this.catalogService.createOptions({ ...input, restaurant: restaurantId });
  }

  @Mutation(() => RestaurantModel, { name: 'storEditOption' })
  async storEditOption(
    @CurrentUser() jwt: JwtUser,
    @Args('option') input: EditOptionInput,
  ) {
    const restaurantId = await this.resolveOwnedRestaurantId(jwt.userId);
    return this.catalogService.editOption({ ...input, restaurant: restaurantId });
  }

  @Mutation(() => RestaurantModel, { name: 'storDeleteOption' })
  async storDeleteOption(
    @CurrentUser() jwt: JwtUser,
    @Args('id', { type: () => ID }) id: string,
  ) {
    const restaurantId = await this.resolveOwnedRestaurantId(jwt.userId);
    return this.catalogService.deleteOption(id, restaurantId);
  }

  // ── Addons ─────────────────────────────────────────────────────────────────

  @Mutation(() => RestaurantModel, { name: 'storCreateAddons' })
  async storCreateAddons(
    @CurrentUser() jwt: JwtUser,
    @Args('addons') input: AddonInput,
  ) {
    const restaurantId = await this.resolveOwnedRestaurantId(jwt.userId);
    return this.catalogService.createAddons({ ...input, restaurant: restaurantId });
  }

  @Mutation(() => RestaurantModel, { name: 'storEditAddon' })
  async storEditAddon(
    @CurrentUser() jwt: JwtUser,
    @Args('addon') input: EditAddonInput,
  ) {
    const restaurantId = await this.resolveOwnedRestaurantId(jwt.userId);
    return this.catalogService.editAddon({ ...input, restaurant: restaurantId });
  }

  @Mutation(() => RestaurantModel, { name: 'storDeleteAddon' })
  async storDeleteAddon(
    @CurrentUser() jwt: JwtUser,
    @Args('id', { type: () => ID }) id: string,
  ) {
    const restaurantId = await this.resolveOwnedRestaurantId(jwt.userId);
    return this.catalogService.deleteAddon(id, restaurantId);
  }

  // ── Restaurant profile (store-facing) ──────────────────────────────────────

  @Mutation(() => RestaurantModel, { name: 'storEditRestaurantProfile' })
  async storEditRestaurantProfile(
    @CurrentUser() jwt: JwtUser,
    @Args('restaurant', { type: () => RestaurantProfileInput }) input: RestaurantProfileInput,
  ) {
    const restaurantId = await this.resolveOwnedRestaurantId(jwt.userId);
    // Only allow updating safe profile fields (image, logo, cuisines, name, phone)
    const { image, logo, cuisines, name, phone } = input;
    return this.restaurantsService.edit({ _id: restaurantId, image, logo, cuisines, name, phone });
  }
}
