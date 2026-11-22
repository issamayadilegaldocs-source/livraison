import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SecurityModule } from '../auth/security.module';
import { AuditModule } from '../audit/audit.module';
import { RestaurantsModule } from '../restaurants/restaurants.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { User, UserSchema } from './user.schema';
import { Order, OrderSchema } from '../orders/order.schema';
import { UsersService } from './users.service';
import { UsersResolver } from './users.resolver';
import { UsersAdminResolver } from './users-admin.resolver';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Order.name, schema: OrderSchema },
    ]),
    forwardRef(() => SecurityModule),
    AuditModule,
    forwardRef(() => RestaurantsModule),
    forwardRef(() => NotificationsModule),
  ],
  providers: [UsersService, UsersResolver, UsersAdminResolver],
  exports: [UsersService],
})
export class UsersModule {}
