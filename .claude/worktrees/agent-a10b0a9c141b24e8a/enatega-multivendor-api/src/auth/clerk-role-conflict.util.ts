import { BadRequestException } from '@nestjs/common';
import { Role } from './roles.enum';

/**
 * Guards role-provisioning flows (createRider, createVendor, invitations, …)
 * against silently clobbering an unrelated Clerk account's role when an admin
 * action reuses an existing email. Promoting an account that has no role yet
 * (a plain Clerk signup) or that is already CUSTOMER is safe — that is the
 * intended "this person signed up, now make them a vendor/rider" path. Any
 * other existing role (ADMIN, or a *different* VENDOR/RIDER/STORE role) means
 * the email belongs to someone else's identity in a different app and must
 * not be overwritten.
 */
export function assertClerkRolePromotable(
  existingRole: string | undefined | null,
  desiredRole: Role,
  context: string,
): void {
  if (!existingRole || existingRole === Role.CUSTOMER || existingRole === desiredRole) {
    return;
  }
  throw new BadRequestException(
    `This email already belongs to a Clerk account with role ${existingRole}. ` +
      `Use a different email to create a ${desiredRole.toLowerCase()} ${context}.`,
  );
}
