import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SecurityModule } from '../auth/security.module';
import { AuditModule } from '../audit/audit.module';
import { OrdersModule } from '../orders/orders.module';
import { RidersModule } from '../riders/riders.module';
import { RestaurantsModule } from '../restaurants/restaurants.module';
import { ConfigurationModule } from '../configuration/configuration.module';
import { WithdrawRequest, WithdrawRequestSchema } from './withdraw.schema';
import { WalletService } from './wallet.service';
import { WalletRiderResolver } from './wallet-rider.resolver';
import { WalletStoreResolver } from './wallet-store.resolver';
import { WalletAdminResolver } from './wallet-admin.resolver';
import { WithdrawMoneyResolver } from './withdraw-money.resolver';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: WithdrawRequest.name, schema: WithdrawRequestSchema },
    ]),
    SecurityModule,
    AuditModule,
    OrdersModule,
    RidersModule,
    RestaurantsModule,
    ConfigurationModule,
  ],
  providers: [WalletService, WalletRiderResolver, WalletStoreResolver, WalletAdminResolver, WithdrawMoneyResolver],
})
export class WalletModule {}
