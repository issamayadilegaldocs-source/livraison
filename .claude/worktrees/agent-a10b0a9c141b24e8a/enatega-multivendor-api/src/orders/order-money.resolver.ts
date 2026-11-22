import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { OrderModel } from './order.model';
import { MoneyModel, toMoneyModel } from '../common/money/money.model';
import { MoneyCurrency } from '../common/money/money';

/**
 * Additive `MoneyModel` read surface for orders.
 *
 * Each field is derived from the canonical `*Minor` units already persisted on
 * the order, using the order's stored `orderAmountCurrency`/`orderAmountScale`
 * metadata so every component shares one currency/scale. The legacy numeric
 * fields (`orderAmount`, `deliveryCharges`, ...) remain untouched; these are
 * nullable companions that resolve to `null` for legacy orders that predate the
 * minor-unit dual-write.
 *
 * This is a field resolver on `OrderModel`, so it applies wherever an order is
 * returned (customer, admin, store, rider resolvers) without changing any root
 * query/mutation authorization.
 */
@Resolver(() => OrderModel)
export class OrderMoneyResolver {
  @ResolveField(() => MoneyModel, { name: 'orderAmountMoney', nullable: true })
  orderAmountMoney(@Parent() order: any): MoneyModel | null {
    return toMoneyModel(order?.orderAmountMinor, this.currencyOf(order));
  }

  @ResolveField(() => MoneyModel, { name: 'paidAmountMoney', nullable: true })
  paidAmountMoney(@Parent() order: any): MoneyModel | null {
    return toMoneyModel(order?.paidAmountMinor, this.currencyOf(order));
  }

  @ResolveField(() => MoneyModel, { name: 'subtotalMoney', nullable: true })
  subtotalMoney(@Parent() order: any): MoneyModel | null {
    return toMoneyModel(order?.subtotalMinor, this.currencyOf(order));
  }

  @ResolveField(() => MoneyModel, { name: 'deliveryChargesMoney', nullable: true })
  deliveryChargesMoney(@Parent() order: any): MoneyModel | null {
    return toMoneyModel(order?.deliveryChargesMinor, this.currencyOf(order));
  }

  @ResolveField(() => MoneyModel, { name: 'tippingMoney', nullable: true })
  tippingMoney(@Parent() order: any): MoneyModel | null {
    return toMoneyModel(order?.tippingMinor, this.currencyOf(order));
  }

  @ResolveField(() => MoneyModel, { name: 'taxationAmountMoney', nullable: true })
  taxationAmountMoney(@Parent() order: any): MoneyModel | null {
    return toMoneyModel(order?.taxationAmountMinor, this.currencyOf(order));
  }

  @ResolveField(() => MoneyModel, { name: 'discountAmountMoney', nullable: true })
  discountAmountMoney(@Parent() order: any): MoneyModel | null {
    return toMoneyModel(order?.discountAmountMinor, this.currencyOf(order));
  }

  @ResolveField(() => MoneyModel, { name: 'loyaltyDiscountMoney', nullable: true })
  loyaltyDiscountMoney(@Parent() order: any): MoneyModel | null {
    return toMoneyModel(order?.loyaltyDiscountMinor, this.currencyOf(order));
  }

  @ResolveField(() => MoneyModel, { name: 'expressSurchargeMoney', nullable: true })
  expressSurchargeMoney(@Parent() order: any): MoneyModel | null {
    return toMoneyModel(order?.expressSurchargeMinor, this.currencyOf(order));
  }

  @ResolveField(() => MoneyModel, { name: 'serviceFeeMoney', nullable: true })
  serviceFeeMoney(@Parent() order: any): MoneyModel | null {
    return toMoneyModel(order?.serviceFeeMinor, this.currencyOf(order));
  }

  @ResolveField(() => MoneyModel, { name: 'riderCommissionMoney', nullable: true })
  riderCommissionMoney(@Parent() order: any): MoneyModel | null {
    return toMoneyModel(order?.riderCommissionMinor, this.currencyOf(order));
  }

  @ResolveField(() => MoneyModel, { name: 'deliveryBonusMoney', nullable: true })
  deliveryBonusMoney(@Parent() order: any): MoneyModel | null {
    return toMoneyModel(order?.deliveryBonusMinor, this.currencyOf(order));
  }

  @ResolveField(() => MoneyModel, { name: 'riderEarningsMoney', nullable: true })
  riderEarningsMoney(@Parent() order: any): MoneyModel | null {
    return toMoneyModel(order?.riderEarningsMinor, this.currencyOf(order));
  }

  private currencyOf(order: any): MoneyCurrency {
    return {
      currency: order?.orderAmountCurrency,
      scale: order?.orderAmountScale,
    };
  }
}
