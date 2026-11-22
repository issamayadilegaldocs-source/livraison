import { UseGuards } from '@nestjs/common';
import { Args, Float, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { Roles } from '../auth/roles.decorator';
import { Role, JwtUser } from '../auth/roles.enum';
import { ConfigurationService } from '../configuration/configuration.service';
import { LoyaltyAccountModel } from './loyalty-account.model';
import { LoyaltyService } from './loyalty.service';

@UseGuards(ClerkAuthGuard, RolesGuard)
@Resolver()
export class LoyaltyResolver {
  constructor(
    private readonly loyaltyService: LoyaltyService,
    private readonly configurationService: ConfigurationService,
  ) {}

  @Roles(Role.CUSTOMER)
  @Query(() => LoyaltyAccountModel, { name: 'myLoyaltyAccount' })
  async myLoyaltyAccount(@CurrentUser() jwt: JwtUser): Promise<LoyaltyAccountModel> {
    const account = await this.loyaltyService.getBalance(jwt.userId);
    return {
      _id: String((account as any)._id),
      userId: account.userId,
      points: account.points,
      lifetimePoints: account.lifetimePoints,
      updatedAt: (account as any).updatedAt?.toISOString?.(),
    };
  }

  @Roles(Role.CUSTOMER)
  @Query(() => Float, { name: 'loyaltyPointsValue' })
  async loyaltyPointsValue(
    @CurrentUser() jwt: JwtUser,
    @Args('points', { type: () => Int }) points: number,
    @Args('redemptionRate', { type: () => Float, nullable: true, defaultValue: 100 })
    redemptionRate: number,
  ): Promise<number> {
    if (points <= 0 || redemptionRate <= 0) return 0;
    const config = await this.configurationService.get();
    return this.loyaltyService.pointsValue(points, redemptionRate, {
      currency: config.currency,
      scale: config.currencyDecimalDigits,
    });
  }
}
