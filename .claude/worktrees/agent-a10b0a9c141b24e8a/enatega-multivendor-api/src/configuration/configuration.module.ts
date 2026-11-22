import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SecurityModule } from '../auth/security.module';
import { ConfigurationAdminResolver } from './configuration-admin.resolver';
import { ConfigurationResolver } from './configuration.resolver';
import { ConfigurationMoneyResolver } from './configuration-money.resolver';
import { Configuration, ConfigurationSchema } from './configuration.schema';
import { ConfigurationService } from './configuration.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Configuration.name, schema: ConfigurationSchema },
    ]),
    // Provides ClerkAuthGuard/RolesGuard for the protected admin mutations.
    SecurityModule,
  ],
  providers: [
    ConfigurationResolver,
    ConfigurationAdminResolver,
    ConfigurationMoneyResolver,
    ConfigurationService,
  ],
  exports: [ConfigurationService],
})
export class ConfigurationModule {}
