import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule } from '@nestjs/config';
import { SecurityModule } from '../auth/security.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { Rider, RiderSchema } from './rider.schema';
import { RidersService } from './riders.service';
import { RidersResolver } from './riders.resolver';
import { RidersAdminResolver } from './riders-admin.resolver';
import { RiderOnboardingResolver } from './riders-onboarding.resolver';
import { RiderMoneyResolver } from './rider-money.resolver';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Rider.name, schema: RiderSchema }]),
    ConfigModule,
    forwardRef(() => SecurityModule),
    forwardRef(() => NotificationsModule),
  ],
  providers: [RidersService, RidersResolver, RidersAdminResolver, RiderOnboardingResolver, RiderMoneyResolver],
  exports: [RidersService],
})
export class RidersModule {}
