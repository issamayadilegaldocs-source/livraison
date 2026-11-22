import { Module } from '@nestjs/common';
import { ClerkAuthGuard } from './clerk-auth.guard';
import { RolesGuard } from './roles.guard';

/**
 * Lightweight Clerk security primitives (token verification + guards) with no
 * dependency on feature modules. Feature modules import this — never the full
 * {@link AuthModule} — so that auth guards don't drag the webhook controller
 * and its service dependencies into a circular dependency.
 */
@Module({
  providers: [ClerkAuthGuard, RolesGuard],
  exports: [ClerkAuthGuard, RolesGuard],
})
export class SecurityModule {}
