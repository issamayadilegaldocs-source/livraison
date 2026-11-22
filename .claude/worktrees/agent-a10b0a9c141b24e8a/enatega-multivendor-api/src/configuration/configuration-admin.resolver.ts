import { UseGuards } from '@nestjs/common';
import { Args, Mutation, Resolver } from '@nestjs/graphql';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '../auth/roles.enum';
import { RolesGuard } from '../auth/roles.guard';
import { ConfigurationModel } from './configuration.model';
import { ConfigurationService } from './configuration.service';
import {
  AppConfigurationsInput,
  AppTypeInput,
  CurrencyConfigurationInput,
  DeliveryCostConfigurationInput,
  ExpressConfigurationInput,
  FinanceConfigurationInput,
  LoyaltyConfigurationInput,
  RiderBonusConfigurationInput,
  RiderCommissionConfigurationInput,
  ServiceFeeConfigurationInput,
  VerificationConfigurationInput,
} from './dto/configuration.input';

/**
 * The configuration `save*` mutations. They are the first protected resolvers
 * in the API: each requires a valid bearer token ({@link ClerkAuthGuard}) and the
 * super-admin {@link Role.ADMIN} role ({@link RolesGuard}). Provider
 * credentials are intentionally excluded and must be configured through env.
 * The public `configuration` query lives in {@link ConfigurationResolver} and
 * stays unguarded.
 */
// All mutations here inherit @Roles(Role.ADMIN). Any new mutation added to this
// class must carry an explicit method-level @Roles(Role.ADMIN) to prevent a
// silent access change if the class decorator is ever overridden.
@Resolver(() => ConfigurationModel)
@UseGuards(ClerkAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class ConfigurationAdminResolver {
  constructor(private readonly configurationService: ConfigurationService) {}

  @Mutation(() => ConfigurationModel, { name: 'saveAppConfigurations' })
  saveAppConfigurations(
    @Args('configurationInput', { type: () => AppConfigurationsInput })
    configurationInput: AppConfigurationsInput,
  ): Promise<ConfigurationModel> {
    return this.save(configurationInput);
  }

  @Mutation(() => ConfigurationModel, { name: 'saveDeliveryRateConfiguration' })
  saveDeliveryRateConfiguration(
    @Args('configurationInput', { type: () => DeliveryCostConfigurationInput })
    configurationInput: DeliveryCostConfigurationInput,
  ): Promise<ConfigurationModel> {
    return this.save(configurationInput);
  }

  @Mutation(() => ConfigurationModel, { name: 'saveVerificationsToggle' })
  saveVerificationsToggle(
    @Args('configurationInput', { type: () => VerificationConfigurationInput })
    configurationInput: VerificationConfigurationInput,
  ): Promise<ConfigurationModel> {
    return this.save(configurationInput);
  }

  @Mutation(() => ConfigurationModel, { name: 'saveCurrencyConfiguration' })
  saveCurrencyConfiguration(
    @Args('configurationInput', { type: () => CurrencyConfigurationInput })
    configurationInput: CurrencyConfigurationInput,
  ): Promise<ConfigurationModel> {
    return this.save(configurationInput);
  }

  @Mutation(() => ConfigurationModel, { name: 'saveFinanceConfiguration' })
  saveFinanceConfiguration(
    @Args('configurationInput', { type: () => FinanceConfigurationInput })
    configurationInput: FinanceConfigurationInput,
  ): Promise<ConfigurationModel> {
    return this.save(configurationInput);
  }

  @Mutation(() => ConfigurationModel, { name: 'saveRiderCommissionConfiguration' })
  saveRiderCommissionConfiguration(
    @Args('configurationInput', { type: () => RiderCommissionConfigurationInput })
    configurationInput: RiderCommissionConfigurationInput,
  ): Promise<ConfigurationModel> {
    return this.save(configurationInput);
  }

  @Mutation(() => ConfigurationModel, { name: 'saveLoyaltyConfiguration' })
  saveLoyaltyConfiguration(
    @Args('configurationInput', { type: () => LoyaltyConfigurationInput })
    configurationInput: LoyaltyConfigurationInput,
  ): Promise<ConfigurationModel> {
    return this.save(configurationInput);
  }

  @Mutation(() => ConfigurationModel, { name: 'saveExpressConfiguration' })
  saveExpressConfiguration(
    @Args('configurationInput', { type: () => ExpressConfigurationInput })
    configurationInput: ExpressConfigurationInput,
  ): Promise<ConfigurationModel> {
    return this.save(configurationInput);
  }

  @Mutation(() => ConfigurationModel, { name: 'saveServiceFeeConfiguration' })
  saveServiceFeeConfiguration(
    @Args('configurationInput', { type: () => ServiceFeeConfigurationInput })
    configurationInput: ServiceFeeConfigurationInput,
  ): Promise<ConfigurationModel> {
    return this.save(configurationInput);
  }

  @Mutation(() => ConfigurationModel, { name: 'saveRiderBonusConfiguration' })
  saveRiderBonusConfiguration(
    @Args('configurationInput', { type: () => RiderBonusConfigurationInput })
    configurationInput: RiderBonusConfigurationInput,
  ): Promise<ConfigurationModel> {
    return this.save(configurationInput);
  }

  @Roles(Role.ADMIN)
  @Mutation(() => Boolean, { name: 'setVersions' })
  async setVersions(
    @Args('customerAppVersion', { type: () => AppTypeInput, nullable: true }) customerAppVersion?: AppTypeInput,
    @Args('riderAppVersion', { type: () => AppTypeInput, nullable: true }) riderAppVersion?: AppTypeInput,
    @Args('restaurantAppVersion', { type: () => AppTypeInput, nullable: true }) restaurantAppVersion?: AppTypeInput,
  ): Promise<boolean> {
    const patch: Record<string, unknown> = {};
    if (customerAppVersion) patch.customerAppVersion = customerAppVersion;
    if (riderAppVersion) patch.riderAppVersion = riderAppVersion;
    if (restaurantAppVersion) patch.restaurantAppVersion = restaurantAppVersion;
    await this.configurationService.update(patch);
    return true;
  }

  /** Applies a section patch and returns the full configuration document. */
  private async save(patch: object): Promise<ConfigurationModel> {
    const doc = await this.configurationService.update(patch);
    return doc.toObject() as unknown as ConfigurationModel;
  }
}
