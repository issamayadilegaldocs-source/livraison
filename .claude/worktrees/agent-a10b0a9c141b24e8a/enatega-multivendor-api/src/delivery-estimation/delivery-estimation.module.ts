import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SecurityModule } from '../auth/security.module';
import { Configuration, ConfigurationSchema } from '../configuration/configuration.schema';
import { GoogleRoutesProvider } from '../providers/google-routes.provider';
import { Restaurant, RestaurantSchema } from '../restaurants/restaurant.schema';
import { DeliveryEstimationResolver } from './delivery-estimation.resolver';
import { DeliveryEstimationService } from './delivery-estimation.service';

@Module({
  imports: [
    SecurityModule,
    MongooseModule.forFeature([
      { name: Restaurant.name, schema: RestaurantSchema },
      { name: Configuration.name, schema: ConfigurationSchema },
    ]),
  ],
  providers: [DeliveryEstimationService, GoogleRoutesProvider, DeliveryEstimationResolver],
  exports: [DeliveryEstimationService],
})
export class DeliveryEstimationModule {}
