import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { RiderModel } from './rider.model';
import { MoneyModel, toMoneyModel } from '../common/money/money.model';
import { MoneyCurrency } from '../common/money/money';

/**
 * Additive `MoneyModel` read surface for rider wallet totals.
 *
 * Each field is derived from the canonical `*Minor` units already persisted on
 * the rider, using the rider's stored `walletAmountCurrency`/`walletAmountScale`
 * metadata. The legacy numeric fields (`currentWalletAmount`, ...) remain
 * untouched; these are nullable companions so clients can format from
 * `minorUnits` + `scale` instead of re-rounding a float with `toFixed(2)`.
 *
 * This is a field resolver on `RiderModel`, so it applies wherever a rider is
 * returned without changing any root query/mutation authorization.
 */
@Resolver(() => RiderModel)
export class RiderMoneyResolver {
  @ResolveField(() => MoneyModel, { name: 'currentWalletAmountMoney', nullable: true })
  currentWalletAmountMoney(@Parent() rider: any): MoneyModel | null {
    return toMoneyModel(rider?.currentWalletAmountMinor, this.currencyOf(rider));
  }

  @ResolveField(() => MoneyModel, { name: 'totalWalletAmountMoney', nullable: true })
  totalWalletAmountMoney(@Parent() rider: any): MoneyModel | null {
    return toMoneyModel(rider?.totalWalletAmountMinor, this.currencyOf(rider));
  }

  @ResolveField(() => MoneyModel, { name: 'withdrawnWalletAmountMoney', nullable: true })
  withdrawnWalletAmountMoney(@Parent() rider: any): MoneyModel | null {
    return toMoneyModel(rider?.withdrawnWalletAmountMinor, this.currencyOf(rider));
  }

  private currencyOf(rider: any): MoneyCurrency {
    return {
      currency: rider?.walletAmountCurrency,
      scale: rider?.walletAmountScale,
    };
  }
}
