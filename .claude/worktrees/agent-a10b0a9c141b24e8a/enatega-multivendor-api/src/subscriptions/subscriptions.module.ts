import { Module } from '@nestjs/common';
import { SecurityModule } from '../auth/security.module';
import { SubscriptionsResolver } from './subscriptions.resolver';
import { RidersModule } from '../riders/riders.module';
import { OrdersModule } from '../orders/orders.module';
import { RestaurantsModule } from '../restaurants/restaurants.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [SecurityModule, RidersModule, OrdersModule, RestaurantsModule, UsersModule],
  providers: [SubscriptionsResolver],
})
export class SubscriptionsModule {}
