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
import {
  Restaurant,
  RestaurantDocument,
  RestaurantSchema,
} from '../restaurants/restaurant.schema';

/**
 * Idempotent backfill for legacy catalog/configuration prices created before
 * canonical minor-unit fields existed.
 *
 * Run:
 * npm run backfill:catalog-configuration-money
 *
 * Dry run:
 * CATALOG_CONFIGURATION_MONEY_BACKFILL_DRY_RUN=true npm run backfill:catalog-configuration-money
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
      { name: Restaurant.name, schema: RestaurantSchema },
      { name: Configuration.name, schema: ConfigurationSchema },
    ]),
  ],
})
class BackfillModule {}

interface LegacyCatalogVariation {
  price?: number;
  priceMinor?: number | null;
  discounted?: number;
  discountedMinor?: number | null;
}

interface LegacyCatalogFood {
  variations?: LegacyCatalogVariation[];
}

interface LegacyCatalogCategory {
  foods?: LegacyCatalogFood[];
}

interface LegacyCatalogOption {
  price?: number;
  priceMinor?: number | null;
}

interface LegacyRestaurantCatalog {
  categories?: LegacyCatalogCategory[];
  options?: LegacyCatalogOption[];
}

interface LegacyConfigurationPrices {
  currency?: string | null;
  currencyDecimalDigits?: number | null;
  deliveryRate?: number;
  deliveryRateMinor?: number | null;
  baseDeliveryFee?: number;
  baseDeliveryFeeMinor?: number | null;
  expressSurcharge?: number;
  expressSurchargeMinor?: number | null;
}

export interface BackfillCatalogConfigurationMoneyStats {
  scanned: number;
  updated: number;
  skipped: number;
  failed: number;
}

function isMissing(value: unknown): boolean {
  return value === undefined || value === null || value === '';
}

function finiteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function minorFromLegacyAmount(value: unknown, currencyConfig: MoneyCurrency): number | undefined {
  if (!finiteNumber(value)) return undefined;
  return Money.fromDecimal(value, currencyConfig).toSafeMinorNumber();
}

function resolvedCurrencyConfig(config: MoneyCurrency): Required<MoneyCurrency> {
  const normalized = Money.fromDecimal(0, config);
  return { currency: normalized.currency, scale: normalized.scale };
}

export function buildRestaurantCatalogMoneyBackfillPatch(
  restaurant: LegacyRestaurantCatalog,
  currencyConfig: MoneyCurrency,
): Record<string, number> {
  const normalized = resolvedCurrencyConfig(currencyConfig);
  const patch: Record<string, number> = {};

  restaurant.categories?.forEach((category, categoryIndex) => {
    category.foods?.forEach((food, foodIndex) => {
      food.variations?.forEach((variation, variationIndex) => {
        const path = `categories.${categoryIndex}.foods.${foodIndex}.variations.${variationIndex}`;
        if (isMissing(variation.priceMinor)) {
          const minor = minorFromLegacyAmount(variation.price ?? 0, normalized);
          if (minor !== undefined) patch[`${path}.priceMinor`] = minor;
        }
        if (isMissing(variation.discountedMinor)) {
          const minor = minorFromLegacyAmount(variation.discounted ?? 0, normalized);
          if (minor !== undefined) patch[`${path}.discountedMinor`] = minor;
        }
      });
    });
  });

  restaurant.options?.forEach((option, optionIndex) => {
    if (!isMissing(option.priceMinor)) return;
    const minor = minorFromLegacyAmount(option.price ?? 0, normalized);
    if (minor !== undefined) patch[`options.${optionIndex}.priceMinor`] = minor;
  });

  return patch;
}

export function buildConfigurationPriceMoneyBackfillPatch(
  config: LegacyConfigurationPrices,
): Record<string, number> {
  const currencyConfig = resolvedCurrencyConfig({
    currency: config.currency ?? undefined,
    scale: config.currencyDecimalDigits ?? undefined,
  });
  const patch: Record<string, number> = {};

  if (isMissing(config.deliveryRateMinor)) {
    const minor = minorFromLegacyAmount(config.deliveryRate ?? 0, currencyConfig);
    if (minor !== undefined) patch.deliveryRateMinor = minor;
  }
  if (isMissing(config.baseDeliveryFeeMinor)) {
    const minor = minorFromLegacyAmount(config.baseDeliveryFee ?? 0, currencyConfig);
    if (minor !== undefined) patch.baseDeliveryFeeMinor = minor;
  }
  if (isMissing(config.expressSurchargeMinor)) {
    const minor = minorFromLegacyAmount(config.expressSurcharge ?? 0, currencyConfig);
    if (minor !== undefined) patch.expressSurchargeMinor = minor;
  }

  return patch;
}

async function loadFallbackCurrencyConfig(
  configurationModel: Model<ConfigurationDocument>,
): Promise<Required<MoneyCurrency>> {
  const config = await configurationModel
    .findOne({}, 'currency currencyDecimalDigits')
    .lean()
    .exec();

  return resolvedCurrencyConfig({
    currency: (config as any)?.currency,
    scale: (config as any)?.currencyDecimalDigits,
  });
}

async function backfill(): Promise<void> {
  const logger = new Logger('BackfillCatalogConfigurationMoney');
  const dryRun = process.env.CATALOG_CONFIGURATION_MONEY_BACKFILL_DRY_RUN === 'true';
  const app = await NestFactory.createApplicationContext(BackfillModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    const restaurantModel = app.get<Model<RestaurantDocument>>(getModelToken(Restaurant.name));
    const configurationModel = app.get<Model<ConfigurationDocument>>(
      getModelToken(Configuration.name),
    );
    const fallbackCurrency = await loadFallbackCurrencyConfig(configurationModel);

    const stats: BackfillCatalogConfigurationMoneyStats = {
      scanned: 0,
      updated: 0,
      skipped: 0,
      failed: 0,
    };

    const restaurantQuery = {
      $or: [
        { 'categories.foods.variations.priceMinor': { $exists: false } },
        { 'categories.foods.variations.priceMinor': null },
        { 'categories.foods.variations.discountedMinor': { $exists: false } },
        { 'categories.foods.variations.discountedMinor': null },
        { 'options.priceMinor': { $exists: false } },
        { 'options.priceMinor': null },
      ],
    };

    const restaurantCursor = restaurantModel
      .find(restaurantQuery, '_id name categories options')
      .lean()
      .cursor();

    for await (const restaurant of restaurantCursor as AsyncIterable<any>) {
      stats.scanned++;
      try {
        const patch = buildRestaurantCatalogMoneyBackfillPatch(restaurant, fallbackCurrency);
        if (Object.keys(patch).length === 0) {
          stats.skipped++;
          continue;
        }

        if (!dryRun) {
          await restaurantModel.updateOne({ _id: restaurant._id }, { $set: patch }).exec();
        }
        stats.updated++;
      } catch (err) {
        stats.failed++;
        logger.warn(`Skipped restaurant ${restaurant.name ?? restaurant._id}: ${(err as Error).message}`);
      }
    }

    const configurationQuery = {
      $or: [
        { deliveryRateMinor: { $exists: false } },
        { deliveryRateMinor: null },
        { baseDeliveryFeeMinor: { $exists: false } },
        { baseDeliveryFeeMinor: null },
        { expressSurchargeMinor: { $exists: false } },
        { expressSurchargeMinor: null },
      ],
    };

    const configurationCursor = configurationModel
      .find(
        configurationQuery,
        '_id currency currencyDecimalDigits deliveryRate deliveryRateMinor baseDeliveryFee baseDeliveryFeeMinor expressSurcharge expressSurchargeMinor',
      )
      .lean()
      .cursor();

    for await (const config of configurationCursor as AsyncIterable<any>) {
      stats.scanned++;
      try {
        const patch = buildConfigurationPriceMoneyBackfillPatch(config);
        if (Object.keys(patch).length === 0) {
          stats.skipped++;
          continue;
        }

        if (!dryRun) {
          await configurationModel.updateOne({ _id: config._id }, { $set: patch }).exec();
        }
        stats.updated++;
      } catch (err) {
        stats.failed++;
        logger.warn(`Skipped configuration ${config._id}: ${(err as Error).message}`);
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
