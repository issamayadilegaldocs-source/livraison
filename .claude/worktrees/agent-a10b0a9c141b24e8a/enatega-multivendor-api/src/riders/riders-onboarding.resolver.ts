import { ForbiddenException, UseGuards } from '@nestjs/common';
import { Mutation, Resolver } from '@nestjs/graphql';
import { createClerkClient } from '@clerk/backend';
import { ConfigService } from '@nestjs/config';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtUser } from '../auth/roles.enum';
import { RiderModel } from './rider.model';
import { RiderDocument } from './rider.schema';
import { RidersService } from './riders.service';

/**
 * Handles the one-time account-linking step for riders who were pre-created by
 * an admin. Intentionally guarded by ClerkAuthGuard only (no RolesGuard) so a
 * rider can call this before their Clerk publicMetadata.role is set to RIDER.
 */
@UseGuards(ClerkAuthGuard)
@Resolver()
export class RiderOnboardingResolver {
  constructor(
    private readonly ridersService: RidersService,
    private readonly config: ConfigService,
  ) {}

  @Mutation(() => RiderModel, { name: 'linkRiderAccount', nullable: true })
  async linkRiderAccount(@CurrentUser() jwt: JwtUser): Promise<RiderDocument> {
    const secretKey = this.config.getOrThrow<string>('CLERK_SECRET_KEY');
    const clerk = createClerkClient({ secretKey });

    const clerkUser = await clerk.users.getUser(jwt.userId);
    const email = clerkUser.emailAddresses[0]?.emailAddress;
    if (!email) throw new ForbiddenException('Clerk account has no email address');

    // Idempotently ensure the Clerk account carries the RIDER role. A rider can
    // already be linked (clerkId set) yet still have publicMetadata.role
    // undefined — e.g. created before role auto-provisioning, or linked by a
    // path that didn't set it. Returning early here would leave them stuck on
    // "Insufficient role" forever, so always reconcile the role.
    const ensureRiderRole = async () => {
      if (clerkUser.publicMetadata?.role !== 'RIDER') {
        await clerk.users.updateUserMetadata(jwt.userId, {
          publicMetadata: { role: 'RIDER' },
        });
      }
    };

    const existing = await this.ridersService.findByClerkId(jwt.userId);
    if (existing) {
      await ensureRiderRole();
      return existing;
    }

    const rider = await this.ridersService.findByEmail(email);
    if (!rider) throw new ForbiddenException('No pre-created rider record found for this email');

    const linked = await this.ridersService.setClerkId(String(rider._id), jwt.userId);

    await ensureRiderRole();

    return linked;
  }
}
