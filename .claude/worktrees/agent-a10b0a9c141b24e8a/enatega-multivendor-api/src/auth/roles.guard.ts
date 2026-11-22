import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GqlExecutionContext } from '@nestjs/graphql';
import { ROLES_KEY } from './roles.decorator';
import { JwtUser, Role } from './roles.enum';

/**
 * Authorizes the actor against the roles declared by {@link Roles}. Must run
 * after {@link ClerkAuthGuard}, which attaches the decoded `request.user`.
 * Handlers without a `@Roles()` declaration are blocked (deny-by-default).
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required?.length) return false;

    const ctx = GqlExecutionContext.create(context);
    const gqlContext = ctx.getContext();
    const user: JwtUser | undefined = gqlContext.req?.user ?? gqlContext.user;
    if (!user || !required.includes(user.role)) {
      throw new ForbiddenException('Insufficient role');
    }
    return true;
  }
}
