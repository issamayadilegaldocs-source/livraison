import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SecurityModule } from '../auth/security.module';
import { Order, OrderSchema } from '../orders/order.schema';
import { Restaurant, RestaurantSchema } from '../restaurants/restaurant.schema';
import { User, UserSchema } from '../users/user.schema';
import { Rider, RiderSchema } from '../riders/rider.schema';
import { Owner, OwnerSchema } from '../owners/owner.schema';
import { Zone, ZoneSchema } from '../zones/zone.schema';
import { TrackingModule } from '../tracking/tracking.module';
import { DashboardService } from './dashboard.service';
import { DashboardResolver } from './dashboard.resolver';
import { OperationsService } from './operations.service';
import { OperationsResolver } from './operations.resolver';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Order.name, schema: OrderSchema },
      { name: Restaurant.name, schema: RestaurantSchema },
      { name: User.name, schema: UserSchema },
      { name: Rider.name, schema: RiderSchema },
      { name: Owner.name, schema: OwnerSchema },
      // Read-only: operations is this codebase's accepted cross-domain
      // read-model layer (see zoneOperationalStats/dispatchHotspots), so it
      // reads the Zone collection directly rather than routing through
      // ZonesModule, mirroring how it already reads Order/Restaurant/Rider.
      { name: Zone.name, schema: ZoneSchema },
    ]),
    SecurityModule,
    // Rider presence for fleet stats/live map — tracking owns the Redis keys.
    TrackingModule,
  ],
  providers: [DashboardService, DashboardResolver, OperationsService, OperationsResolver],
})
export class DashboardModule {}
