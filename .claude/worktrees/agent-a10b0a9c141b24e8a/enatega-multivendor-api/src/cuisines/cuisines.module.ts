import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Cuisine, CuisineSchema } from './cuisine.schema';
import { CuisinesService } from './cuisines.service';
import { CuisinesResolver } from './cuisines.resolver';
import { SecurityModule } from '../auth/security.module';
import { RestaurantsModule } from '../restaurants/restaurants.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Cuisine.name, schema: CuisineSchema },
    ]),
    RestaurantsModule,
    SecurityModule,
  ],
  providers: [CuisinesService, CuisinesResolver],
  exports: [CuisinesService],
})
export class CuisinesModule {}
