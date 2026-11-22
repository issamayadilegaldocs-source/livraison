import { Module } from '@nestjs/common';
import { OwnersModule } from '../owners/owners.module';
import { UsersModule } from '../users/users.module';
import { ClerkWebhookController } from './clerk-webhook.controller';
import { SecurityModule } from './security.module';

/**
 * Houses the Clerk webhook controller (user sync) and re-exports SecurityModule
 * so callers that import AuthModule still get ClerkAuthGuard and RolesGuard.
 * Feature modules should prefer importing SecurityModule directly to avoid
 * pulling in the webhook controller's service dependencies.
 */
@Module({
  imports: [SecurityModule, UsersModule, OwnersModule],
  controllers: [ClerkWebhookController],
  exports: [SecurityModule],
})
export class AuthModule {}
