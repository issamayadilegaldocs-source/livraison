import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Money, MoneyCurrency } from '../common/money/money';
import { Configuration, ConfigurationDocument } from './configuration.schema';

@Injectable()
export class ConfigurationService {
  constructor(
    @InjectModel(Configuration.name)
    private readonly configurationModel: Model<ConfigurationDocument>,
  ) {}

  /**
   * Returns the single configuration document, creating one with schema
   * defaults on first access so the clients always receive a value.
   */
  async get(): Promise<ConfigurationDocument> {
    const existing = await this.configurationModel.findOne().exec();
    if (existing) {
      return existing;
    }
    return this.configurationModel.create({});
  }

  async getGlobalCurrency(): Promise<string> {
    const config = await this.get();
    return config.currency ?? 'USD';
  }

  /**
   * Merges a partial patch into the single configuration document. Used by the
   * admin `save*Configuration` mutations, each of which owns one section.
   * `undefined` fields are dropped so an omitted value never clears an existing
   * one; an explicit `null` is honoured as a clear.
   */
  async update(patch: Partial<Configuration>): Promise<ConfigurationDocument> {
    const clean = Object.fromEntries(
      Object.entries(patch).filter(([, value]) => value !== undefined),
    ) as Partial<Configuration>;
    const existing = await this.get();
    const currencyConfig: MoneyCurrency = {
      currency: clean.currency ?? existing.currency,
      scale: clean.currencyDecimalDigits ?? existing.currencyDecimalDigits,
    };
    this.addMoneyMinor(clean, 'deliveryRate', 'deliveryRateMinor', currencyConfig);
    this.addMoneyMinor(clean, 'baseDeliveryFee', 'baseDeliveryFeeMinor', currencyConfig);
    this.addMoneyMinor(clean, 'deliveryFeeMinimum', 'deliveryFeeMinimumMinor', currencyConfig);
    this.addMoneyMinor(clean, 'deliveryFeeMaximum', 'deliveryFeeMaximumMinor', currencyConfig);
    this.addMoneyMinor(clean, 'expressSurcharge', 'expressSurchargeMinor', currencyConfig);
    this.addMoneyMinor(clean, 'serviceFeeMinimum', 'serviceFeeMinimumMinor', currencyConfig);
    this.addMoneyMinor(clean, 'serviceFeeMaximum', 'serviceFeeMaximumMinor', currencyConfig);
    this.addMoneyMinor(clean, 'deliveryBonusMax', 'deliveryBonusMaxMinor', currencyConfig);

    return this.configurationModel
      .findOneAndUpdate({}, { $set: clean }, { new: true, upsert: true })
      .exec() as Promise<ConfigurationDocument>;
  }

  private addMoneyMinor(
    patch: Partial<Configuration>,
    legacyField: keyof Configuration,
    minorField: keyof Configuration,
    currencyConfig: MoneyCurrency,
  ): void {
    const value = patch[legacyField];
    if (typeof value !== 'number') return;
    (patch as Record<string, unknown>)[minorField as string] = Money.fromDecimal(
      value,
      currencyConfig,
    ).toSafeMinorNumber();
  }
}
