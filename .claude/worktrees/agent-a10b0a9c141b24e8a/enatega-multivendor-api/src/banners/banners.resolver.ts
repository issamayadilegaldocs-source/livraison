import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { BannerModel } from './banner.model';
import { BannersService } from './banners.service';
import { BannerInput } from './dto/banner.input';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '../auth/roles.enum';

@Resolver(() => BannerModel)
export class BannersResolver {
  constructor(private readonly bannersService: BannersService) {}

  @Query(() => [BannerModel], { name: 'banners' })
  banners() {
    return this.bannersService.findAll();
  }

  @Mutation(() => BannerModel)
  @UseGuards(ClerkAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  createBanner(
    @Args('bannerInput', { type: () => BannerInput }) input: BannerInput,
  ) {
    return this.bannersService.create(input);
  }

  @Mutation(() => BannerModel)
  @UseGuards(ClerkAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  editBanner(
    @Args('bannerInput', { type: () => BannerInput }) input: BannerInput,
  ) {
    return this.bannersService.edit(input);
  }

  @Mutation(() => Boolean)
  @UseGuards(ClerkAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  deleteBanner(@Args('id', { type: () => String }) id: string) {
    return this.bannersService.delete(id);
  }
}
