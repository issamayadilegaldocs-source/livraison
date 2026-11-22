import { UseGuards } from '@nestjs/common';
import { Query, Resolver } from '@nestjs/graphql';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { Role, JwtUser } from '../auth/roles.enum';
import { CustomerWalletModel } from './customer-wallet.model';
import { CustomerWalletService } from './customer-wallet.service';

@UseGuards(ClerkAuthGuard, RolesGuard)
@Roles(Role.CUSTOMER)
@Resolver(() => CustomerWalletModel)
export class CustomerWalletResolver {
  constructor(private readonly customerWalletService: CustomerWalletService) {}

  @Query(() => CustomerWalletModel, { name: 'myWallet' })
  myWallet(@CurrentUser() jwt: JwtUser): Promise<CustomerWalletModel> {
    return this.customerWalletService.getWallet(
      jwt.userId,
    ) as unknown as Promise<CustomerWalletModel>;
  }
}
