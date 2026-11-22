import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ShopType, ShopTypeSchema } from './shop-type.schema';
import { ShopTypesService } from './shop-types.service';
import { ShopTypesResolver } from './shop-types.resolver';
import { SecurityModule } from '../auth/security.module';
import { RestaurantsModule } from '../restaurants/restaurants.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ShopType.name, schema: ShopTypeSchema },
    ]),
    RestaurantsModule,
    SecurityModule,
  ],
  providers: [ShopTypesService, ShopTypesResolver],
  exports: [ShopTypesService],
})
export class ShopTypesModule {}
