import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SecurityModule } from '../auth/security.module';
import { ConfigurationModule } from '../configuration/configuration.module';
import { LoyaltyAccount, LoyaltyAccountSchema } from './loyalty-account.schema';
import { LoyaltyService } from './loyalty.service';
import { LoyaltyResolver } from './loyalty.resolver';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: LoyaltyAccount.name, schema: LoyaltyAccountSchema }]),
    SecurityModule,
    ConfigurationModule,
  ],
  providers: [LoyaltyService, LoyaltyResolver],
  exports: [LoyaltyService],
})
export class LoyaltyModule {}
