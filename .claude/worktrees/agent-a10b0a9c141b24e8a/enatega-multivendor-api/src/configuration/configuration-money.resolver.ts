import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { ConfigurationModel } from './configuration.model';
import { MoneyModel, toMoneyModel } from '../common/money/money.model';
import { MoneyCurrency } from '../common/money/money';

/**
 * Additive `MoneyModel` read surface for admin-configured delivery/express
 * prices.
 *
 * Each field is derived from the canonical `*Minor` units persisted on the
 * configuration document, using its own `currency`/`currencyDecimalDigits` as the
 * money scale. The legacy numeric fields (`deliveryRate`, `baseDeliveryFee`,
 * `expressSurcharge`) remain untouched; these are nullable companions so clients
 * format from `minorUnits` + `scale` instead of re-rounding a float.
 *
 * This is a field resolver on `ConfigurationModel`, so it applies wherever the
 * configuration is returned without changing any root authorization.
 */
@Resolver(() => ConfigurationModel)
export class ConfigurationMoneyResolver {
  @ResolveField(() => MoneyModel, { name: 'deliveryRateMoney', nullable: true })
  deliveryRateMoney(@Parent() config: any): MoneyModel | null {
    return toMoneyModel(config?.deliveryRateMinor, this.currencyOf(config));
  }

  @ResolveField(() => MoneyModel, { name: 'baseDeliveryFeeMoney', nullable: true })
  baseDeliveryFeeMoney(@Parent() config: any): MoneyModel | null {
    return toMoneyModel(config?.baseDeliveryFeeMinor, this.currencyOf(config));
  }

  @ResolveField(() => MoneyModel, { name: 'deliveryFeeMinimumMoney', nullable: true })
  deliveryFeeMinimumMoney(@Parent() config: any): MoneyModel | null {
    return toMoneyModel(config?.deliveryFeeMinimumMinor, this.currencyOf(config));
  }

  @ResolveField(() => MoneyModel, { name: 'deliveryFeeMaximumMoney', nullable: true })
  deliveryFeeMaximumMoney(@Parent() config: any): MoneyModel | null {
    return toMoneyModel(config?.deliveryFeeMaximumMinor, this.currencyOf(config));
  }

  @ResolveField(() => MoneyModel, { name: 'expressSurchargeMoney', nullable: true })
  expressSurchargeMoney(@Parent() config: any): MoneyModel | null {
    return toMoneyModel(config?.expressSurchargeMinor, this.currencyOf(config));
  }

  @ResolveField(() => MoneyModel, { name: 'serviceFeeMinimumMoney', nullable: true })
  serviceFeeMinimumMoney(@Parent() config: any): MoneyModel | null {
    return toMoneyModel(config?.serviceFeeMinimumMinor, this.currencyOf(config));
  }

  @ResolveField(() => MoneyModel, { name: 'serviceFeeMaximumMoney', nullable: true })
  serviceFeeMaximumMoney(@Parent() config: any): MoneyModel | null {
    return toMoneyModel(config?.serviceFeeMaximumMinor, this.currencyOf(config));
  }

  @ResolveField(() => MoneyModel, { name: 'deliveryBonusMaxMoney', nullable: true })
  deliveryBonusMaxMoney(@Parent() config: any): MoneyModel | null {
    return toMoneyModel(config?.deliveryBonusMaxMinor, this.currencyOf(config));
  }

  private currencyOf(config: any): MoneyCurrency {
    return {
      currency: config?.currency,
      scale: config?.currencyDecimalDigits,
    };
  }
}
