import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SecurityModule } from '../auth/security.module';
import { Configuration, ConfigurationSchema } from '../configuration/configuration.schema';
import { Order, OrderSchema } from './order.schema';
import { Review, ReviewSchema } from './review.schema';
import { Rider, RiderSchema } from '../riders/rider.schema';
import { OrdersService } from './orders.service';
import { ORDER_EARNINGS_PORT } from './order-earnings.port';
import { OrderEarningsService } from './order-earnings.service';
import { ORDER_PAYMENT_PORT } from './order-payment.port';
import { OrderPaymentService } from './order-payment.service';
import { OrdersResolver } from './orders.resolver';
import { OrderMoneyResolver } from './order-money.resolver';
import { OrdersStoreResolver } from './orders-store.resolver';
import { OrdersAdminResolver } from './orders-admin.resolver';
import { OrdersRiderResolver } from './orders-rider.resolver';
import { RidersModule } from '../riders/riders.module';
import { TrackingModule } from '../tracking/tracking.module';
import { OffersModule } from '../offers/offers.module';
import { DeliveryEstimationModule } from '../delivery-estimation/delivery-estimation.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { LoyaltyModule } from '../loyalty/loyalty.module';
import { CouponsModule } from '../coupons/coupons.module';
import { CustomerWalletModule } from '../customer-wallet/customer-wallet.module';
import { DispatchModule } from '../dispatch/dispatch.module';
import { UsersModule } from '../users/users.module';
import { RestaurantsModule } from '../restaurants/restaurants.module';
import { ZonesModule } from '../zones/zones.module';
import { PaymentAttemptsModule } from '../payments/payment-attempts.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Order.name, schema: OrderSchema },
      { name: Review.name, schema: ReviewSchema },
      { name: Configuration.name, schema: ConfigurationSchema },
      { name: Rider.name, schema: RiderSchema },
    ]),
    SecurityModule,
    UsersModule,
    RestaurantsModule,
    ZonesModule,
    forwardRef(() => RidersModule),
    TrackingModule,
    OffersModule,
    DeliveryEstimationModule,
    NotificationsModule,
    DispatchModule,
    LoyaltyModule,
    CouponsModule,
    CustomerWalletModule,
    PaymentAttemptsModule,
  ],
  providers: [
    OrdersService,
    OrderEarningsService,
    { provide: ORDER_EARNINGS_PORT, useExisting: OrderEarningsService },
    OrderPaymentService,
    { provide: ORDER_PAYMENT_PORT, useExisting: OrderPaymentService },
    OrdersResolver,
    OrderMoneyResolver,
    OrdersStoreResolver,
    OrdersAdminResolver,
    OrdersRiderResolver,
  ],
  exports: [OrdersService, ORDER_EARNINGS_PORT, ORDER_PAYMENT_PORT],
})
export class OrdersModule {}
