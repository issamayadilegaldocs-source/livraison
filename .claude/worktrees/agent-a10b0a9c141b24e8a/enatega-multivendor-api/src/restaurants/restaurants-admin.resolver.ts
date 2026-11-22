import { Args, Float, ID, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import {
  CommissionRatePaginatedModel,
  MutationResultModel,
  OwnerWithRestaurantsModel,
  RestaurantDeliveryZoneInfoModel,
  RestaurantModel,
  RestaurantsPaginatedModel,
} from './restaurant.model';
import { RestaurantsService } from './restaurants.service';
import { CatalogService } from './catalog.service';
import { RestaurantInput, RestaurantProfileInput, BussinessDetailsInput, OpeningTimeInput, TimingsInput } from './dto/restaurant.input';
import { CategoryInput, FoodInput, AddonInput, EditAddonInput, CreateOptionInput, EditOptionInput } from './dto/catalog.input';
import { CoordinatesInput, CircleBoundsInput } from '../common/dto/geo.input';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '../auth/roles.enum';

@Resolver(() => RestaurantModel)
@UseGuards(ClerkAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class RestaurantsAdminResolver {
  constructor(
    private readonly restaurantsService: RestaurantsService,
    private readonly catalogService: CatalogService,
  ) {}

  // ── Restaurant queries ───────────────────────────────────────────────────

  @Query(() => RestaurantsPaginatedModel, { name: 'restaurantsPaginated' })
  restaurantsPaginated(
    @Args('page', { type: () => Int, nullable: true }) page?: number,
    @Args('limit', { type: () => Int, nullable: true }) limit?: number,
    @Args('search', { type: () => String, nullable: true }) search?: string,
  ) {
    return this.restaurantsService.findPaginated(page, limit, search);
  }

  @Query(() => OwnerWithRestaurantsModel, { name: 'restaurantByOwner', nullable: true })
  restaurantByOwner(
    @Args('id', { type: () => String, nullable: true }) id?: string,
  ) {
    if (!id) return null;
    return this.restaurantsService.findByOwner(id);
  }

  @Query(() => RestaurantDeliveryZoneInfoModel, { name: 'getRestaurantDeliveryZoneInfo', nullable: true })
  getRestaurantDeliveryZoneInfo(
    @Args('id', { type: () => ID }) id: string,
  ) {
    return this.restaurantsService.getDeliveryZoneInfo(id);
  }

  @Query(() => [RestaurantModel], { name: 'getClonedRestaurants' })
  getClonedRestaurants() {
    return this.restaurantsService.findAllAdmin();
  }

  @Query(() => RestaurantsPaginatedModel, { name: 'getClonedRestaurantsPaginated' })
  getClonedRestaurantsPaginated(
    @Args('page', { type: () => Int, nullable: true }) page?: number,
    @Args('limit', { type: () => Int, nullable: true }) limit?: number,
    @Args('search', { type: () => String, nullable: true }) search?: string,
  ) {
    return this.restaurantsService.findPaginated(page, limit, search);
  }

  @Query(() => CommissionRatePaginatedModel, { name: 'commissionRate' })
  commissionRate(
    @Args('page', { type: () => Int, nullable: true }) page?: number,
    @Args('limit', { type: () => Int, nullable: true }) limit?: number,
  ) {
    return this.restaurantsService.commissionRate(page, limit);
  }

  // ── Restaurant mutations ─────────────────────────────────────────────────

  @Mutation(() => RestaurantModel)
  createRestaurant(
    @Args('restaurant', { type: () => RestaurantInput }) restaurant: RestaurantInput,
    @Args('owner', { type: () => ID }) owner: string,
  ) {
    return this.restaurantsService.create(restaurant, owner);
  }

  @Mutation(() => RestaurantModel)
  deleteRestaurant(@Args('id', { type: () => String }) id: string) {
    return this.restaurantsService.delete(id);
  }

  @Mutation(() => Boolean)
  hardDeleteRestaurant(@Args('id', { type: () => String }) id: string) {
    return this.restaurantsService.hardDelete(id);
  }

  @Mutation(() => RestaurantModel)
  editRestaurant(
    @Args('restaurant', { type: () => RestaurantProfileInput }) restaurant: RestaurantProfileInput,
  ) {
    return this.restaurantsService.edit(restaurant);
  }

  @Mutation(() => MutationResultModel)
  updateDeliveryBoundsAndLocation(
    @Args('id', { type: () => ID }) id: string,
    @Args('boundType', { type: () => String }) boundType: string,
    @Args('location', { type: () => CoordinatesInput }) location: CoordinatesInput,
    @Args('bounds', { type: () => [[[Float]]], nullable: true }) bounds?: number[][][],
    @Args('circleBounds', { type: () => CircleBoundsInput, nullable: true }) circleBounds?: CircleBoundsInput,
    @Args('address', { type: () => String, nullable: true }) address?: string,
    @Args('postCode', { type: () => String, nullable: true }) postCode?: string,
    @Args('city', { type: () => String, nullable: true }) city?: string,
  ) {
    const polygonInput = bounds ? { coordinates: bounds } : undefined;
    return this.restaurantsService.updateDeliveryBoundsAndLocation(
      id, boundType, location, polygonInput, circleBounds, address, postCode, city,
    );
  }

  @Mutation(() => MutationResultModel)
  updateRestaurantDelivery(
    @Args('id', { type: () => ID }) id: string,
    @Args('minDeliveryFee', { type: () => Float, nullable: true }) minDeliveryFee?: number,
    @Args('deliveryDistance', { type: () => Float, nullable: true }) deliveryDistance?: number,
    @Args('deliveryFee', { type: () => Float, nullable: true }) deliveryFee?: number,
  ) {
    return this.restaurantsService.updateDelivery(id, minDeliveryFee, deliveryDistance, deliveryFee);
  }

  @Roles(Role.ADMIN, Role.STORE, Role.VENDOR)
  @Mutation(() => MutationResultModel)
  updateRestaurantBussinessDetails(
    @Args('id', { type: () => String }) id: string,
    @Args('bussinessDetails', { type: () => BussinessDetailsInput, nullable: true })
    bussinessDetails?: BussinessDetailsInput,
  ) {
    return this.restaurantsService.updateBussinessDetails(id, bussinessDetails!);
  }

  @Mutation(() => RestaurantModel)
  duplicateRestaurant(
    @Args('id', { type: () => String }) id: string,
    @Args('owner', { type: () => String }) owner: string,
  ) {
    return this.restaurantsService.duplicate(id, owner);
  }

  @Mutation(() => RestaurantModel, { name: 'updateCommission' })
  updateCommission(
    @Args('id', { type: () => String }) id: string,
    @Args('commissionRate', { type: () => Float }) commissionRate: number,
  ) {
    return this.restaurantsService.updateCommission(id, commissionRate);
  }

  @Roles(Role.ADMIN, Role.STORE, Role.VENDOR)
  @Mutation(() => RestaurantModel, { name: 'updateTimings' })
  updateTimings(
    @Args('id', { type: () => String }) id: string,
    @Args('openingTimes', { type: () => [TimingsInput], nullable: 'itemsAndList' }) openingTimes?: TimingsInput[],
  ) {
    return this.restaurantsService.updateTimings(id, (openingTimes ?? []).filter(Boolean) as TimingsInput[]);
  }

  @Mutation(() => RestaurantModel, { name: 'updateDeliveryOptions' })
  updateDeliveryOptions(
    @Args('restId', { type: () => String }) restId: string,
    @Args('pickup', { type: () => Boolean }) pickup: boolean,
    @Args('delivery', { type: () => Boolean }) delivery: boolean,
  ) {
    return this.restaurantsService.updateDeliveryOptions(restId, pickup, delivery);
  }

  // ── Category mutations ───────────────────────────────────────────────────

  @Roles(Role.ADMIN, Role.VENDOR)
  @Mutation(() => RestaurantModel)
  createCategory(
    @Args('category', { type: () => CategoryInput }) category: CategoryInput,
  ) {
    return this.catalogService.createCategory(category);
  }

  @Roles(Role.ADMIN, Role.VENDOR)
  @Mutation(() => RestaurantModel)
  editCategory(
    @Args('category', { type: () => CategoryInput }) category: CategoryInput,
  ) {
    return this.catalogService.editCategory(category);
  }

  @Roles(Role.ADMIN, Role.VENDOR)
  @Mutation(() => RestaurantModel)
  deleteCategory(
    @Args('id', { type: () => String }) id: string,
    @Args('restaurant', { type: () => String }) restaurant: string,
  ) {
    return this.catalogService.deleteCategory(id, restaurant);
  }

  // ── Food mutations ───────────────────────────────────────────────────────

  @Roles(Role.ADMIN, Role.VENDOR)
  @Mutation(() => RestaurantModel)
  createFood(
    @Args('foodInput', { type: () => FoodInput }) foodInput: FoodInput,
  ) {
    return this.catalogService.createFood(foodInput);
  }

  @Roles(Role.ADMIN, Role.VENDOR)
  @Mutation(() => RestaurantModel)
  editFood(
    @Args('foodInput', { type: () => FoodInput }) foodInput: FoodInput,
  ) {
    return this.catalogService.editFood(foodInput);
  }

  @Roles(Role.ADMIN, Role.VENDOR)
  @Mutation(() => RestaurantModel)
  deleteFood(
    @Args('id', { type: () => String }) id: string,
    @Args('restaurant', { type: () => String }) restaurant: string,
    @Args('categoryId', { type: () => String }) categoryId: string,
  ) {
    return this.catalogService.deleteFood(id, restaurant, categoryId);
  }

  @Roles(Role.ADMIN, Role.VENDOR)
  @Mutation(() => Boolean)
  updateFoodOutOfStock(
    @Args('id', { type: () => String }) id: string,
    @Args('restaurant', { type: () => String }) restaurant: string,
    @Args('categoryId', { type: () => String }) categoryId: string,
  ) {
    return this.catalogService.updateFoodOutOfStock(id, restaurant, categoryId);
  }

  // ── Option mutations ─────────────────────────────────────────────────────

  @Roles(Role.ADMIN, Role.VENDOR)
  @Mutation(() => RestaurantModel)
  createOptions(
    @Args('optionInput', { type: () => CreateOptionInput, nullable: true })
    optionInput: CreateOptionInput,
  ) {
    return this.catalogService.createOptions(optionInput);
  }

  @Roles(Role.ADMIN, Role.VENDOR)
  @Mutation(() => RestaurantModel)
  editOption(
    @Args('optionInput', { type: () => EditOptionInput, nullable: true })
    optionInput: EditOptionInput,
  ) {
    return this.catalogService.editOption(optionInput);
  }

  @Roles(Role.ADMIN, Role.VENDOR)
  @Mutation(() => RestaurantModel)
  deleteOption(
    @Args('id', { type: () => String }) id: string,
    @Args('restaurant', { type: () => String }) restaurant: string,
  ) {
    return this.catalogService.deleteOption(id, restaurant);
  }

  // ── Addon mutations ──────────────────────────────────────────────────────

  @Roles(Role.ADMIN, Role.VENDOR)
  @Mutation(() => RestaurantModel)
  createAddons(
    @Args('addonInput', { type: () => AddonInput, nullable: true })
    addonInput: AddonInput,
  ) {
    return this.catalogService.createAddons(addonInput);
  }

  @Roles(Role.ADMIN, Role.VENDOR)
  @Mutation(() => RestaurantModel)
  editAddon(
    @Args('addonInput', { type: () => EditAddonInput, nullable: true })
    addonInput: EditAddonInput,
  ) {
    return this.catalogService.editAddon(addonInput);
  }

  @Roles(Role.ADMIN, Role.VENDOR)
  @Mutation(() => RestaurantModel)
  deleteAddon(
    @Args('id', { type: () => String }) id: string,
    @Args('restaurant', { type: () => String }) restaurant: string,
  ) {
    return this.catalogService.deleteAddon(id, restaurant);
  }
}
