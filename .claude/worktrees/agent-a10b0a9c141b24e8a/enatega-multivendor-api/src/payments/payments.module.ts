import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SecurityModule } from '../auth/security.module';
import { OrdersModule } from '../orders/orders.module';
import { CustomerWalletModule } from '../customer-wallet/customer-wallet.module';
import { WalletTopUp, WalletTopUpSchema } from '../customer-wallet/wallet-topup.schema';
import { FlouciProvider } from '../providers/flouci.provider';
import { PaymentAttemptsModule } from './payment-attempts.module';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { PaymentsResolver } from './payments.resolver';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: WalletTopUp.name, schema: WalletTopUpSchema }]),
    SecurityModule,
    OrdersModule,
    CustomerWalletModule,
    PaymentAttemptsModule,
  ],
  controllers: [PaymentsController],
  providers: [PaymentsService, PaymentsResolver, FlouciProvider],
})
export class PaymentsModule {}
