import { Mutation, Query, Resolver } from '@nestjs/graphql';
import { randomUUID } from 'crypto';
import { ConfigurationModel, MetricsGeneralModel, VersionsModel } from './configuration.model';
import { ConfigurationService } from './configuration.service';

@Resolver(() => ConfigurationModel)
export class ConfigurationResolver {
  constructor(private readonly configurationService: ConfigurationService) {}

  /** Public read used by every client app. */
  @Query(() => ConfigurationModel, { name: 'configuration' })
  async configuration(): Promise<ConfigurationModel> {
    const doc = await this.configurationService.get();
    return doc.toObject() as unknown as ConfigurationModel;
  }

  @Mutation(() => MetricsGeneralModel, { name: 'metricsGeneral' })
  metricsGeneral(): MetricsGeneralModel {
    const token = randomUUID().replace(/-/g, '');
    const expiry = new Date(Date.now() + 3_600_000).toISOString();
    return { experience: token, hehe: expiry };
  }

  @Query(() => VersionsModel, { name: 'getVersions', nullable: true })
  async getVersions(): Promise<VersionsModel> {
    const doc = await this.configurationService.get();
    const cfg = doc.toObject() as any;
    return {
      customerAppVersion: cfg.customerAppVersion,
      riderAppVersion: cfg.riderAppVersion,
      restaurantAppVersion: cfg.restaurantAppVersion,
    };
  }
}
