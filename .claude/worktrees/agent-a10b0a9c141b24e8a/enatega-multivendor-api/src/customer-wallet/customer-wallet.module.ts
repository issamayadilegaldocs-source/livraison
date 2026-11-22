import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SecurityModule } from '../auth/security.module';
import {
  CustomerWallet,
  CustomerWalletSchema,
  CustomerWalletTransaction,
  CustomerWalletTransactionSchema,
} from './customer-wallet.schema';
import { WalletTopUp, WalletTopUpSchema } from './wallet-topup.schema';
import { CustomerWalletService } from './customer-wallet.service';
import { CustomerWalletResolver } from './customer-wallet.resolver';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: CustomerWallet.name, schema: CustomerWalletSchema },
      { name: CustomerWalletTransaction.name, schema: CustomerWalletTransactionSchema },
      { name: WalletTopUp.name, schema: WalletTopUpSchema },
    ]),
    SecurityModule,
  ],
  providers: [CustomerWalletService, CustomerWalletResolver],
  exports: [CustomerWalletService],
})
export class CustomerWalletModule {}
