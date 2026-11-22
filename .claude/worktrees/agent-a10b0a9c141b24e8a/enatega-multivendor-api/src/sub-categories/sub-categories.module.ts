import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SubCategory, SubCategorySchema } from './sub-category.schema';
import { SubCategoriesService } from './sub-categories.service';
import { SubCategoriesResolver } from './sub-categories.resolver';
import { SecurityModule } from '../auth/security.module';
import { RestaurantsModule } from '../restaurants/restaurants.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: SubCategory.name, schema: SubCategorySchema },
    ]),
    forwardRef(() => RestaurantsModule),
    SecurityModule,
  ],
  providers: [SubCategoriesService, SubCategoriesResolver],
  exports: [SubCategoriesService],
})
export class SubCategoriesModule {}
