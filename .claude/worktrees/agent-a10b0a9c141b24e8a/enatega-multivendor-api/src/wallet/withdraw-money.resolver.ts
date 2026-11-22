import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { WithdrawRequestModel } from './withdraw.model';
import { MoneyModel, toMoneyModel } from '../common/money/money.model';
import { MoneyCurrency } from '../common/money/money';

/**
 * Additive `MoneyModel` read surface for withdrawal request/approved amounts.
 *
 * Both fields are derived from the canonical `*Minor` units persisted on the
 * withdraw request, using its stored `requestAmountCurrency`/`requestAmountScale`
 * metadata (the approved amount shares the request's currency/scale). The legacy
 * numeric `requestAmount`/`approvedAmount` fields remain untouched; these are
 * nullable companions so clients format from `minorUnits` + `scale` instead of
 * re-rounding a float.
 *
 * This is a field resolver on `WithdrawRequestModel`, so it applies wherever a
 * withdraw request is returned without changing any root authorization.
 */
@Resolver(() => WithdrawRequestModel)
export class WithdrawMoneyResolver {
  @ResolveField(() => MoneyModel, { name: 'requestAmountMoney', nullable: true })
  requestAmountMoney(@Parent() withdraw: any): MoneyModel | null {
    return toMoneyModel(withdraw?.requestAmountMinor, this.currencyOf(withdraw));
  }

  @ResolveField(() => MoneyModel, { name: 'approvedAmountMoney', nullable: true })
  approvedAmountMoney(@Parent() withdraw: any): MoneyModel | null {
    return toMoneyModel(withdraw?.approvedAmountMinor, this.currencyOf(withdraw));
  }

  private currencyOf(withdraw: any): MoneyCurrency {
    return {
      currency: withdraw?.requestAmountCurrency,
      scale: withdraw?.requestAmountScale,
    };
  }
}
