import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { VariationModel, OptionModel } from './restaurant.model';
import { MoneyModel, toMoneyModel } from '../common/money/money.model';
import { MoneyCurrency } from '../common/money/money';
import { ConfigurationService } from '../configuration/configuration.service';

/**
 * Cached global currency config for catalog money rendering.
 *
 * Catalog price minor units are stamped at write time using the active global
 * `Configuration.currency`/`currencyDecimalDigits` (embedded catalog docs do not
 * carry per-document currency metadata). A menu render fans out across many
 * variations/options, so a short-lived cache avoids one `Configuration` read per
 * embedded item.
 */
class CurrencyConfigCache {
  private cached?: MoneyCurrency;
  private expiresAt = 0;
  private inflight?: Promise<MoneyCurrency>;
  private readonly ttlMs = 60_000;

  constructor(private readonly load: () => Promise<MoneyCurrency>) {}

  async get(): Promise<MoneyCurrency> {
    const now = Date.now();
    if (this.cached && now < this.expiresAt) return this.cached;
    if (this.inflight) return this.inflight;
    this.inflight = this.load()
      .then((config) => {
        this.cached = config;
        this.expiresAt = Date.now() + this.ttlMs;
        return config;
      })
      .finally(() => {
        this.inflight = undefined;
      });
    return this.inflight;
  }
}

/**
 * Additive `MoneyModel` read surface for catalog variation prices.
 */
@Resolver(() => VariationModel)
export class VariationMoneyResolver {
  private readonly currencyConfig = new CurrencyConfigCache(async () => {
    const config = await this.configurationService.get();
    return { currency: config.currency, scale: config.currencyDecimalDigits };
  });

  constructor(private readonly configurationService: ConfigurationService) {}

  @ResolveField(() => MoneyModel, { name: 'priceMoney', nullable: true })
  async priceMoney(@Parent() variation: any): Promise<MoneyModel | null> {
    return toMoneyModel(variation?.priceMinor, await this.currencyConfig.get());
  }

  @ResolveField(() => MoneyModel, { name: 'discountedMoney', nullable: true })
  async discountedMoney(@Parent() variation: any): Promise<MoneyModel | null> {
    return toMoneyModel(variation?.discountedMinor, await this.currencyConfig.get());
  }
}

/**
 * Additive `MoneyModel` read surface for catalog option prices.
 */
@Resolver(() => OptionModel)
export class OptionMoneyResolver {
  private readonly currencyConfig = new CurrencyConfigCache(async () => {
    const config = await this.configurationService.get();
    return { currency: config.currency, scale: config.currencyDecimalDigits };
  });

  constructor(private readonly configurationService: ConfigurationService) {}

  @ResolveField(() => MoneyModel, { name: 'priceMoney', nullable: true })
  async priceMoney(@Parent() option: any): Promise<MoneyModel | null> {
    return toMoneyModel(option?.priceMinor, await this.currencyConfig.get());
  }
}
