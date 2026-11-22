import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SecurityModule } from '../auth/security.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { Order, OrderSchema } from '../orders/order.schema';
import { GoogleRoutesProvider } from '../providers/google-routes.provider';
import { RestaurantsModule } from '../restaurants/restaurants.module';
import { RidersModule } from '../riders/riders.module';
import { TrackingModule } from '../tracking/tracking.module';
import { DispatchResolver } from './dispatch.resolver';
import { DispatchService } from './dispatch.service';

@Module({
  imports: [
    // Read-only: DispatchService only ever .lean().findById()s an Order to
    // resolve its restaurant/rider/zone for scoring — see dispatch.service.ts's
    // constructor comment for why this doesn't route through OrdersModule.
    MongooseModule.forFeature([{ name: Order.name, schema: OrderSchema }]),
    SecurityModule,
    RestaurantsModule,
    RidersModule,
    TrackingModule,
    NotificationsModule,
  ],
  providers: [DispatchService, GoogleRoutesProvider, DispatchResolver],
  exports: [DispatchService],
})
export class DispatchModule {}
