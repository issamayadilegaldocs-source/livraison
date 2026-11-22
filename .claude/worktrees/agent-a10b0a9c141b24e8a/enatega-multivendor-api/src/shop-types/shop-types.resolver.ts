import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { ShopTypeModel, ShopTypesPaginatedModel } from './shop-type.model';
import { ShopTypesService } from './shop-types.service';
import {
  CreateShopTypeInput,
  DeleteTypeEnum,
  FetchShopTypeFilter,
  FetchUniqueShopTypeInput,
  UpdateShopTypeInput,
} from './dto/shop-type.input';
import { PaginationInput } from '../common/dto/pagination.input';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '../auth/roles.enum';

@Resolver(() => ShopTypeModel)
export class ShopTypesResolver {
  constructor(private readonly shopTypesService: ShopTypesService) {}

  // public read — unauthenticated access is intentional for discovery queries
  @Query(() => ShopTypesPaginatedModel, { name: 'fetchShopTypes' })
  fetchShopTypes(
    @Args('filter', { type: () => FetchShopTypeFilter, nullable: true })
    filter?: FetchShopTypeFilter,
    @Args('pagination', { type: () => PaginationInput, nullable: true })
    pagination?: PaginationInput,
  ) {
    return this.shopTypesService.findPaginated(filter, pagination);
  }

  @Query(() => ShopTypeModel, { name: 'fetchShopTypeByUnique', nullable: true })
  fetchShopTypeByUnique(
    @Args('dto', { type: () => FetchUniqueShopTypeInput, nullable: true })
    dto?: FetchUniqueShopTypeInput,
  ) {
    if (!dto) return null;
    return this.shopTypesService.findByUnique(dto);
  }

  @Query(() => ShopTypesPaginatedModel, { name: 'fetchAllShopTypes' })
  async fetchAllShopTypes() {
    const data = await this.shopTypesService.findAll();
    return {
      data,
      total: data.length,
      page: 1,
      pageSize: data.length,
      totalPages: 1,
      hasNextPage: false,
      hasPrevPage: false,
    };
  }

  @Mutation(() => ShopTypeModel)
  @UseGuards(ClerkAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  createShopType(
    @Args('dto', { type: () => CreateShopTypeInput, nullable: true })
    dto: CreateShopTypeInput,
  ) {
    return this.shopTypesService.create(dto);
  }

  @Mutation(() => ShopTypeModel)
  @UseGuards(ClerkAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  updateShopType(
    @Args('dto', { type: () => UpdateShopTypeInput, nullable: true })
    dto: UpdateShopTypeInput,
  ) {
    return this.shopTypesService.update(dto);
  }

  @Mutation(() => ShopTypeModel)
  @UseGuards(ClerkAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  deleteShopType(
    @Args('id', { type: () => String }) id: string,
    @Args('type', { type: () => DeleteTypeEnum, nullable: true })
    type?: DeleteTypeEnum,
  ) {
    return this.shopTypesService.delete(id, type);
  }
}
