import { UseGuards } from '@nestjs/common';
import { Mutation, Resolver } from '@nestjs/graphql';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtUser } from '../auth/roles.enum';
import { OwnerModel } from './owner.model';
import { OwnersService } from './owners.service';

/**
 * One-time account-linking for vendors who accepted a Clerk invitation.
 * Only ClerkAuthGuard (no RolesGuard) so the vendor can call this before
 * their Clerk publicMetadata.role is set to VENDOR.
 */
@UseGuards(ClerkAuthGuard)
@Resolver()
export class OwnersOnboardingResolver {
  constructor(private readonly ownersService: OwnersService) {}

  @Mutation(() => OwnerModel, { name: 'linkVendorAccount', nullable: true })
  linkVendorAccount(@CurrentUser() jwt: JwtUser) {
    return this.ownersService.linkVendorAccount(jwt.userId);
  }
}
