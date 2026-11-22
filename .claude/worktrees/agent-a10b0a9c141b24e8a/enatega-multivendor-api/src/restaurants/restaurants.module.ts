import { Module, forwardRef } from '@nestjs/common';
import { PubSubModule } from '../pubsub/pubsub.module';
import { MongooseModule } from '@nestjs/mongoose';
import { Restaurant, RestaurantSchema } from './restaurant.schema';
import { Category, CategorySchema } from './catalog/category.schema';
import { Food, FoodSchema } from './catalog/food.schema';
import { Addon, AddonSchema } from './catalog/addon.schema';
import { Option, OptionSchema } from './catalog/option.schema';
import { Zone, ZoneSchema } from '../zones/zone.schema';
import { Owner, OwnerSchema } from '../owners/owner.schema';
import { SubCategoriesModule } from '../sub-categories/sub-categories.module';
import { RestaurantsService } from './restaurants.service';
import { RestaurantLookupService } from './restaurant-lookup.service';
import { RestaurantWalletService } from './restaurant-wallet.service';
import { RestaurantZonesService } from './restaurant-zones.service';
import { RestaurantDiscoveryService } from './restaurant-discovery.service';
import { RestaurantProfileService } from './restaurant-profile.service';
import { RestaurantAvailabilityService } from './restaurant-availability.service';
import { CatalogService } from './catalog.service';
import { RestaurantsResolver, RestaurantPreviewResolver } from './restaurants.resolver';
import { RestaurantsAdminResolver } from './restaurants-admin.resolver';
import { GoogleTimezoneProvider } from '../providers/google-timezone.provider';
import { RestaurantsStoreResolver } from './restaurants-store.resolver';
import { CatalogStoreResolver } from './catalog-store.resolver';
import { RestaurantMoneyResolver } from './restaurant-money.resolver';
import { VariationMoneyResolver, OptionMoneyResolver } from './catalog-money.resolver';
import { SecurityModule } from '../auth/security.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { TimeValueScalar } from '../common/scalars/time-value.scalar';
import { ConfigurationModule } from '../configuration/configuration.module';
import { OrderStatsModule } from '../orders/order-stats.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Restaurant.name, schema: RestaurantSchema },
      { name: Category.name, schema: CategorySchema },
      { name: Food.name, schema: FoodSchema },
      { name: Addon.name, schema: AddonSchema },
      { name: Option.name, schema: OptionSchema },
      { name: Zone.name, schema: ZoneSchema },
      { name: Owner.name, schema: OwnerSchema },
    ]),
    forwardRef(() => SubCategoriesModule),
    forwardRef(() => SecurityModule),
    forwardRef(() => NotificationsModule),
    ConfigurationModule,
    OrderStatsModule,
    PubSubModule,
  ],
  providers: [
    RestaurantsService,
    RestaurantLookupService,
    RestaurantWalletService,
    RestaurantZonesService,
    RestaurantDiscoveryService,
    RestaurantProfileService,
    RestaurantAvailabilityService,
    CatalogService,
    RestaurantsResolver,
    RestaurantPreviewResolver,
    RestaurantsAdminResolver,
    RestaurantsStoreResolver,
    CatalogStoreResolver,
    RestaurantMoneyResolver,
    VariationMoneyResolver,
    OptionMoneyResolver,
    TimeValueScalar,
    GoogleTimezoneProvider,
  ],
  exports: [RestaurantsService, CatalogService],
})
export class RestaurantsModule {}
