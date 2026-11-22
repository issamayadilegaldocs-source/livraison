import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SecurityModule } from '../auth/security.module';
import { AuditModule } from '../audit/audit.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { Offer, OfferSchema } from './offer.schema';
import { Restaurant, RestaurantSchema } from '../restaurants/restaurant.schema';
import { User, UserSchema } from '../users/user.schema';
import { OffersService } from './offers.service';
import { OffersResolver } from './offers.resolver';
import { OffersStoreResolver } from './offers-store.resolver';
import { OffersAdminResolver } from './offers-admin.resolver';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Offer.name, schema: OfferSchema },
      { name: Restaurant.name, schema: RestaurantSchema },
      { name: User.name, schema: UserSchema },
    ]),
    SecurityModule,
    AuditModule,
    forwardRef(() => NotificationsModule),
  ],
  providers: [
    OffersService,
    OffersResolver,
    OffersStoreResolver,
    OffersAdminResolver,
  ],
  exports: [OffersService],
})
export class OffersModule {}
