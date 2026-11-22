import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { createClerkClient, verifyToken } from '@clerk/backend';
import { ConfigService } from '@nestjs/config';
import { Role, JwtUser } from './roles.enum';

/** Session tokens only carry publicMetadata when the Clerk instance's
 * session token is customized; fall back to the Clerk API otherwise,
 * caching per user so we don't call it on every request. */
const ROLE_CACHE_TTL_MS = 60_000;
const roleCache = new Map<string, { role: Role | undefined; expires: number }>();

/** Amortized cleanup so `roleCache` never grows unbounded across the
 * process lifetime — every distinct user who has ever authenticated would
 * otherwise leave a permanent entry (thousands of users/day never gets
 * garbage-collected without a restart). Runs on every cache write instead
 * of a separate interval, since writes happen on every cache-miss anyway. */
function pruneExpiredRoleCacheEntries(now: number): void {
  for (const [key, value] of roleCache) {
    if (value.expires <= now) {
      roleCache.delete(key);
    }
  }
}

/** Test-only escape hatch to assert the cache doesn't grow unbounded. */
export function getRoleCacheSizeForTesting(): number {
  return roleCache.size;
}

@Injectable()
export class ClerkAuthGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const ctx = GqlExecutionContext.create(context);
    const gqlContext = ctx.getContext();
    const req = gqlContext.req;
    const connectionParams = gqlContext.connectionParams ?? {};
    const connectionHeaders = connectionParams.headers ?? {};

    const auth: string | undefined =
      req?.headers?.authorization ??
      req?.headers?.Authorization ??
      connectionParams.Authorization ??
      connectionParams.authorization ??
      connectionHeaders.Authorization ??
      connectionHeaders.authorization;

    if (!auth?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing bearer token');
    }

    const token = auth.slice(7);
    let payload: Awaited<ReturnType<typeof verifyToken>>;

    const secretKey = this.config.getOrThrow<string>('CLERK_SECRET_KEY');
    const rawParties = this.config.get<string>('CLERK_AUTHORIZED_PARTIES', '');
    const authorizedParties = rawParties ? rawParties.split(',').map((s) => s.trim()) : undefined;

    try {
      payload = await verifyToken(token, { secretKey, authorizedParties });
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }

    let role = (payload.publicMetadata as Record<string, unknown>)?.role as Role | undefined;

    if (!role) {
      const cached = roleCache.get(payload.sub);
      if (cached && cached.expires > Date.now()) {
        role = cached.role;
      } else {
        try {
          const clerk = createClerkClient({ secretKey });
          const clerkUser = await clerk.users.getUser(payload.sub);
          role = clerkUser.publicMetadata?.role as Role | undefined;
        } catch {
          role = undefined;
        }
        // Only cache a resolved role. Caching `undefined` (role not yet set, or
        // a transient getUser failure) would pin the actor to CUSTOMER for the
        // full TTL even after their role is assigned — re-fetch next time instead.
        if (role) {
          const now = Date.now();
          pruneExpiredRoleCacheEntries(now);
          roleCache.set(payload.sub, {
            role,
            expires: now + ROLE_CACHE_TTL_MS,
          });
        }
      }
    }

    const user: JwtUser = { userId: payload.sub, role: (role ?? Role.CUSTOMER) as Role };

    if (req) {
      req.user = user;
    } else {
      gqlContext.user = user;
    }

    return true;
  }
}
