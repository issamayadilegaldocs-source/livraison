import { Logger, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { MongooseModule, getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Money, MoneyCurrency } from '../common/money/money';
import {
  Configuration,
  ConfigurationDocument,
  ConfigurationSchema,
} from '../configuration/configuration.schema';
import { Order, OrderDocument, OrderSchema } from '../orders/order.schema';

/**
 * Idempotent backfill for legacy orders created before canonical minor-unit
 * amount fields existed. Fills missing orderAmountMinor/orderAmountCurrency/
 * orderAmountScale, and paidAmountMinor when legacy paid/refunded data supports
 * it.
 *
 * Run:
 * npm run backfill:order-money
 *
 * Dry run:
 * ORDER_MONEY_BACKFILL_DRY_RUN=true npm run backfill:order-money
 */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        uri: config.get<string>('MONGO_URI', 'mongodb://127.0.0.1:27017/enatega'),
      }),
    }),
    MongooseModule.forFeature([
      { name: Order.name, schema: OrderSchema },
      { name: Configuration.name, schema: ConfigurationSchema },
    ]),
  ],
})
class BackfillModule {}

interface LegacyOrderMoney {
  orderAmount?: number;
  orderAmountMinor?: number | null;
  orderAmountCurrency?: string | null;
  orderAmountScale?: number | null;
  paidAmount?: number;
  paidAmountMinor?: number | null;
  paymentStatus?: string | null;
  deliveryCharges?: number;
  deliveryChargesMinor?: number | null;
  tipping?: number;
  tippingMinor?: number | null;
  taxationAmount?: number;
  taxationAmountMinor?: number | null;
  discountAmount?: number;
  discountAmountMinor?: number | null;
  loyaltyDiscount?: number;
  loyaltyDiscountMinor?: number | null;
  expressSurcharge?: number;
  expressSurchargeMinor?: number | null;
  riderCommission?: number;
  riderCommissionMinor?: number | null;
  riderEarnings?: number;
  riderEarningsMinor?: number | null;
}

export interface BackfillOrderMoneyPatch {
  orderAmountMinor?: number;
  orderAmountCurrency?: string;
  orderAmountScale?: number;
  paidAmountMinor?: number;
  deliveryChargesMinor?: number;
  tippingMinor?: number;
  taxationAmountMinor?: number;
  discountAmountMinor?: number;
  loyaltyDiscountMinor?: number;
  expressSurchargeMinor?: number;
  riderCommissionMinor?: number;
  riderEarningsMinor?: number;
}

export interface BackfillOrderMoneyStats {
  scanned: number;
  updated: number;
  skipped: number;
  failed: number;
}

const PAID_LIKE_STATUSES = new Set(['PAID', 'REFUNDED']);

function isMissing(value: unknown): boolean {
  return value === undefined || value === null || value === '';
}

function finiteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function minorFromLegacyAmount(
  order: LegacyOrderMoney,
  legacyField: keyof LegacyOrderMoney,
  minorField: keyof BackfillOrderMoneyPatch,
  currencyConfig: Required<MoneyCurrency>,
  patch: BackfillOrderMoneyPatch,
): void {
  if (!isMissing(order[minorField as keyof LegacyOrderMoney])) return;
  const amount = order[legacyField];
  if (!finiteNumber(amount)) return;
  (patch as Record<keyof BackfillOrderMoneyPatch, number | string | undefined>)[minorField] =
    Money.fromDecimal(amount, currencyConfig).toSafeMinorNumber();
}

function resolvedCurrencyConfig(
  order: LegacyOrderMoney,
  fallback: MoneyCurrency,
): Required<MoneyCurrency> {
  const currency = !isMissing(order.orderAmountCurrency)
    ? String(order.orderAmountCurrency)
    : fallback.currency;
  const scale = !isMissing(order.orderAmountScale) ? Number(order.orderAmountScale) : fallback.scale;

  const normalized = Money.fromDecimal(0, { currency, scale });
  return { currency: normalized.currency, scale: normalized.scale };
}

export function buildOrderMoneyBackfillPatch(
  order: LegacyOrderMoney,
  fallback: MoneyCurrency,
): BackfillOrderMoneyPatch {
  const currencyConfig = resolvedCurrencyConfig(order, fallback);
  const patch: BackfillOrderMoneyPatch = {};

  const needsOrderAmount =
    isMissing(order.orderAmountMinor) ||
    isMissing(order.orderAmountCurrency) ||
    isMissing(order.orderAmountScale);

  if (needsOrderAmount) {
    const amount = finiteNumber(order.orderAmount) ? order.orderAmount : 0;
    const orderMoney = Money.fromDecimal(amount, currencyConfig);
    patch.orderAmountMinor = orderMoney.toSafeMinorNumber();
    patch.orderAmountCurrency = orderMoney.currency;
    patch.orderAmountScale = orderMoney.scale;
  }

  if (isMissing(order.paidAmountMinor)) {
    const status = String(order.paymentStatus ?? '').toUpperCase();
    const paidAmount = finiteNumber(order.paidAmount) ? order.paidAmount : undefined;
    const shouldBackfillPaid =
      paidAmount !== undefined && paidAmount > 0 ? true : PAID_LIKE_STATUSES.has(status);

    if (shouldBackfillPaid) {
      const amount =
        paidAmount !== undefined && paidAmount > 0
          ? paidAmount
          : finiteNumber(order.orderAmount)
            ? order.orderAmount
            : 0;
      patch.paidAmountMinor = Money.fromDecimal(amount, currencyConfig).toSafeMinorNumber();
    }
  }

  minorFromLegacyAmount(order, 'deliveryCharges', 'deliveryChargesMinor', currencyConfig, patch);
  minorFromLegacyAmount(order, 'tipping', 'tippingMinor', currencyConfig, patch);
  minorFromLegacyAmount(order, 'taxationAmount', 'taxationAmountMinor', currencyConfig, patch);
  minorFromLegacyAmount(order, 'discountAmount', 'discountAmountMinor', currencyConfig, patch);
  minorFromLegacyAmount(order, 'loyaltyDiscount', 'loyaltyDiscountMinor', currencyConfig, patch);
  minorFromLegacyAmount(order, 'expressSurcharge', 'expressSurchargeMinor', currencyConfig, patch);
  minorFromLegacyAmount(order, 'riderCommission', 'riderCommissionMinor', currencyConfig, patch);
  minorFromLegacyAmount(order, 'riderEarnings', 'riderEarningsMinor', currencyConfig, patch);

  return patch;
}

async function loadFallbackCurrencyConfig(
  configurationModel: Model<ConfigurationDocument>,
): Promise<Required<MoneyCurrency>> {
  const config = await configurationModel
    .findOne({}, 'currency currencyDecimalDigits')
    .lean()
    .exec();

  const normalized = Money.fromDecimal(0, {
    currency: (config as any)?.currency,
    scale: (config as any)?.currencyDecimalDigits,
  });
  return { currency: normalized.currency, scale: normalized.scale };
}

async function backfill(): Promise<void> {
  const logger = new Logger('BackfillOrderMoney');
  const dryRun = process.env.ORDER_MONEY_BACKFILL_DRY_RUN === 'true';
  const app = await NestFactory.createApplicationContext(BackfillModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    const orderModel = app.get<Model<OrderDocument>>(getModelToken(Order.name));
    const configurationModel = app.get<Model<ConfigurationDocument>>(
      getModelToken(Configuration.name),
    );
    const fallbackCurrency = await loadFallbackCurrencyConfig(configurationModel);

    const query = {
      $or: [
        { orderAmountMinor: { $exists: false } },
        { orderAmountMinor: null },
        { orderAmountCurrency: { $exists: false } },
        { orderAmountCurrency: null },
        { orderAmountCurrency: '' },
        { orderAmountScale: { $exists: false } },
        { orderAmountScale: null },
        { paidAmountMinor: { $exists: false }, paymentStatus: { $in: ['PAID', 'REFUNDED'] } },
        { paidAmountMinor: null, paymentStatus: { $in: ['PAID', 'REFUNDED'] } },
        { paidAmountMinor: { $exists: false }, paidAmount: { $gt: 0 } },
        { paidAmountMinor: null, paidAmount: { $gt: 0 } },
        { deliveryChargesMinor: { $exists: false } },
        { deliveryChargesMinor: null },
        { tippingMinor: { $exists: false } },
        { tippingMinor: null },
        { taxationAmountMinor: { $exists: false } },
        { taxationAmountMinor: null },
        { discountAmountMinor: { $exists: false } },
        { discountAmountMinor: null },
        { loyaltyDiscountMinor: { $exists: false } },
        { loyaltyDiscountMinor: null },
        { expressSurchargeMinor: { $exists: false } },
        { expressSurchargeMinor: null },
        { riderCommissionMinor: { $exists: false } },
        { riderCommissionMinor: null },
        { riderEarningsMinor: { $exists: false } },
        { riderEarningsMinor: null },
      ],
    };

    const cursor = orderModel
      .find(
        query,
        '_id orderId orderAmount orderAmountMinor orderAmountCurrency orderAmountScale paidAmount paidAmountMinor paymentStatus deliveryCharges deliveryChargesMinor tipping tippingMinor taxationAmount taxationAmountMinor discountAmount discountAmountMinor loyaltyDiscount loyaltyDiscountMinor expressSurcharge expressSurchargeMinor riderCommission riderCommissionMinor riderEarnings riderEarningsMinor',
      )
      .lean()
      .cursor();

    const stats: BackfillOrderMoneyStats = { scanned: 0, updated: 0, skipped: 0, failed: 0 };

    for await (const order of cursor as AsyncIterable<any>) {
      stats.scanned++;
      try {
        const patch = buildOrderMoneyBackfillPatch(order, fallbackCurrency);
        if (Object.keys(patch).length === 0) {
          stats.skipped++;
          continue;
        }

        if (!dryRun) {
          await orderModel.updateOne({ _id: order._id }, { $set: patch }).exec();
        }
        stats.updated++;
      } catch (err) {
        stats.failed++;
        logger.warn(`Skipped order ${order.orderId ?? order._id}: ${(err as Error).message}`);
      }
    }

    logger.log(
      `Backfill complete${dryRun ? ' (dry run)' : ''}: ${stats.updated} updated, ${stats.skipped} skipped, ${stats.failed} failed, ${stats.scanned} scanned`,
    );
  } finally {
    await app.close();
  }
}

if (require.main === module) {
  backfill()
    .then(() => process.exit(0))
    .catch((err) => {
      // eslint-disable-next-line no-console
      console.error('Backfill failed:', err);
      process.exit(1);
    });
}
