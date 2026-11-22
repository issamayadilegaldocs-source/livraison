import { SetMetadata } from '@nestjs/common';
import { Role } from './roles.enum';

export const ROLES_KEY = 'roles';

/**
 * Restricts a resolver/handler to the listed roles. Pair with {@link RolesGuard}
 * (which runs after {@link ClerkAuthGuard} has populated `request.user`).
 */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
