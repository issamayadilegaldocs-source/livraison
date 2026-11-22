import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { RestaurantModel } from './restaurant.model';
import { MoneyModel, toMoneyModel } from '../common/money/money.model';
import { MoneyCurrency } from '../common/money/money';

/**
 * Additive `MoneyModel` read surface for restaurant (store) wallet totals.
 *
 * Each field is derived from the canonical `*Minor` units already persisted on
 * the restaurant, using the restaurant's stored
 * `walletAmountCurrency`/`walletAmountScale` metadata. The legacy numeric fields
 * remain untouched; these are nullable companions so clients can format from
 * `minorUnits` + `scale` instead of re-rounding a float.
 *
 * This is a field resolver on `RestaurantModel`, so it applies wherever a
 * restaurant is returned without changing any root query/mutation authorization.
 */
@Resolver(() => RestaurantModel)
export class RestaurantMoneyResolver {
  @ResolveField(() => MoneyModel, { name: 'currentWalletAmountMoney', nullable: true })
  currentWalletAmountMoney(@Parent() restaurant: any): MoneyModel | null {
    return toMoneyModel(restaurant?.currentWalletAmountMinor, this.currencyOf(restaurant));
  }

  @ResolveField(() => MoneyModel, { name: 'totalWalletAmountMoney', nullable: true })
  totalWalletAmountMoney(@Parent() restaurant: any): MoneyModel | null {
    return toMoneyModel(restaurant?.totalWalletAmountMinor, this.currencyOf(restaurant));
  }

  @ResolveField(() => MoneyModel, { name: 'withdrawnWalletAmountMoney', nullable: true })
  withdrawnWalletAmountMoney(@Parent() restaurant: any): MoneyModel | null {
    return toMoneyModel(restaurant?.withdrawnWalletAmountMinor, this.currencyOf(restaurant));
  }

  private currencyOf(restaurant: any): MoneyCurrency {
    return {
      currency: restaurant?.walletAmountCurrency,
      scale: restaurant?.walletAmountScale,
    };
  }
}
