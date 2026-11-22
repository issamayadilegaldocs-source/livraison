import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { SubCategoryModel } from './sub-category.model';
import { SubCategoriesService } from './sub-categories.service';
import { SubCategoryInput } from './dto/sub-category.input';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '../auth/roles.enum';

@Resolver(() => SubCategoryModel)
export class SubCategoriesResolver {
  constructor(private readonly subCategoriesService: SubCategoriesService) {}

  @Query(() => [SubCategoryModel], { name: 'subCategories' })
  subCategories() {
    return this.subCategoriesService.findAll();
  }

  @Query(() => SubCategoryModel, { name: 'subCategory', nullable: true })
  subCategory(@Args('_id', { type: () => String, nullable: true }) id?: string) {
    if (!id) return null;
    return this.subCategoriesService.findById(id);
  }

  @Query(() => [SubCategoryModel], { name: 'subCategoriesByParentId' })
  subCategoriesByParentId(
    @Args('parentCategoryId', { type: () => String, nullable: true })
    parentCategoryId?: string,
  ) {
    return this.subCategoriesService.findByParentId(parentCategoryId);
  }

  @Mutation(() => Boolean)
  @UseGuards(ClerkAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.VENDOR)
  createSubCategories(
    @Args('subCategories', { type: () => [SubCategoryInput] })
    subCategories: SubCategoryInput[],
  ) {
    return this.subCategoriesService.createMany(subCategories);
  }

  @Mutation(() => Boolean)
  @UseGuards(ClerkAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.VENDOR)
  deleteSubCategory(
    @Args('_id', { type: () => String }) id: string,
  ) {
    return this.subCategoriesService.delete(id);
  }
}
