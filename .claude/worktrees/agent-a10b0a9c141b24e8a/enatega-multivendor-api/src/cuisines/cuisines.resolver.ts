import { Args, Float, Mutation, Query, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { CuisineModel } from './cuisine.model';
import { CuisinesService } from './cuisines.service';
import { CuisineInput } from './dto/cuisine.input';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '../auth/roles.enum';

@Resolver(() => CuisineModel)
export class CuisinesResolver {
  constructor(private readonly cuisinesService: CuisinesService) {}

  @Query(() => [CuisineModel], { name: 'cuisines' })
  cuisines() {
    return this.cuisinesService.findAll();
  }

  @Query(() => [CuisineModel], { name: 'nearByRestaurantsCuisines' })
  nearByRestaurantsCuisines(
    @Args('latitude', { type: () => Float }) _latitude: number,
    @Args('longitude', { type: () => Float }) _longitude: number,
    // Nullable: the web discovery page requests all cuisines in one call and
    // splits restaurant vs grocery client-side (useGetCuisines).
    @Args('shopType', { type: () => String, nullable: true }) shopType?: string,
  ) {
    return this.cuisinesService.findByShopType(shopType);
  }

  @Mutation(() => CuisineModel)
  @UseGuards(ClerkAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  createCuisine(
    @Args('cuisineInput', { type: () => CuisineInput }) input: CuisineInput,
  ) {
    return this.cuisinesService.create(input);
  }

  @Mutation(() => CuisineModel)
  @UseGuards(ClerkAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  editCuisine(
    @Args('cuisineInput', { type: () => CuisineInput }) input: CuisineInput,
  ) {
    return this.cuisinesService.edit(input);
  }

  @Mutation(() => Boolean)
  @UseGuards(ClerkAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  deleteCuisine(@Args('id', { type: () => String }) id: string) {
    return this.cuisinesService.delete(id);
  }
}
