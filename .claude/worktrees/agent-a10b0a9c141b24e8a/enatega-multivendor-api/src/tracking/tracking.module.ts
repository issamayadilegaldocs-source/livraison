import { Module, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { NotificationsModule } from '../notifications/notifications.module';
import { SecurityModule } from '../auth/security.module';
import { Order, OrderSchema } from '../orders/order.schema';
import { Rider, RiderSchema } from '../riders/rider.schema';
import { User, UserSchema } from '../users/user.schema';
import { OrderTrail, OrderTrailSchema } from './order-trail.schema';
import { TRACKING_CONFIG, trackingConfigFactory } from './tracking.config';
import { TrackingResolver } from './tracking.resolver';
import { TrackingService } from './tracking.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Order.name, schema: OrderSchema },
      { name: Rider.name, schema: RiderSchema },
      { name: User.name, schema: UserSchema },
      { name: OrderTrail.name, schema: OrderTrailSchema },
    ]),
    SecurityModule,
    forwardRef(() => NotificationsModule),
  ],
  providers: [
    {
      provide: TRACKING_CONFIG,
      inject: [ConfigService],
      useFactory: trackingConfigFactory,
    },
    TrackingService,
    TrackingResolver,
  ],
  exports: [TrackingService],
})
export class TrackingModule {}
