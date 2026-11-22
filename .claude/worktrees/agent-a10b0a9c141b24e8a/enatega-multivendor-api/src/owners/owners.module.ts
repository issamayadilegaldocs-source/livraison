import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule } from '@nestjs/config';
import { SecurityModule } from '../auth/security.module';
import { Restaurant, RestaurantSchema } from '../restaurants/restaurant.schema';
import { Owner, OwnerSchema } from './owner.schema';
import { OwnersService } from './owners.service';
import { OwnersResolver } from './owners.resolver';
import { OwnersAdminResolver } from './owners-admin.resolver';
import { OwnersOnboardingResolver } from './owners-onboarding.resolver';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Owner.name, schema: OwnerSchema },
      { name: Restaurant.name, schema: RestaurantSchema },
    ]),
    SecurityModule,
    ConfigModule,
  ],
  providers: [OwnersService, OwnersResolver, OwnersAdminResolver, OwnersOnboardingResolver],
  exports: [OwnersService],
})
export class OwnersModule {}
