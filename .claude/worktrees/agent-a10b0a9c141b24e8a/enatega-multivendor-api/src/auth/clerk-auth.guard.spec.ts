import { UnauthorizedException } from '@nestjs/common';
import { ExecutionContext } from '@nestjs/common';
import { createClerkClient, verifyToken } from '@clerk/backend';
import { ClerkAuthGuard, getRoleCacheSizeForTesting } from './clerk-auth.guard';
import { Role } from './roles.enum';

jest.mock('@clerk/backend', () => ({
  createClerkClient: jest.fn(),
  verifyToken: jest.fn(),
}));

describe('ClerkAuthGuard', () => {
  const config = { getOrThrow: jest.fn(), get: jest.fn() };
  let guard: ClerkAuthGuard;

  beforeEach(() => {
    jest.clearAllMocks();
    config.getOrThrow.mockReturnValue('sk_test_secret');
    config.get.mockReturnValue('');
    guard = new ClerkAuthGuard(config as never);
  });

  // GqlExecutionContext.create(context) internally calls context.getArgByIndex(2)
  // to retrieve the GraphQL context object. We stub that directly.
  function contextWith(gqlContext: Record<string, unknown>): ExecutionContext {
    return {
      getType: () => 'graphql',
      getClass: () => ({}),
      getHandler: () => ({}),
      getArgByIndex: (i: number) => (i === 2 ? gqlContext : undefined),
      getArgs: () => [undefined, undefined, gqlContext, undefined],
    } as unknown as ExecutionContext;
  }

  it('rejects a request with no Authorization header', async () => {
    const ctx = contextWith({ req: { headers: {} } });
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
    await expect(guard.canActivate(ctx)).rejects.toThrow('Missing bearer token');
  });

  it('rejects a non-Bearer Authorization header', async () => {
    const ctx = contextWith({ req: { headers: { authorization: 'Basic xyz' } } });
    await expect(guard.canActivate(ctx)).rejects.toThrow('Missing bearer token');
  });

  it('rejects when verifyToken throws (invalid/expired token)', async () => {
    (verifyToken as jest.Mock).mockRejectedValue(new Error('expired'));
    const ctx = contextWith({ req: { headers: { authorization: 'Bearer bad-token' } } });
    await expect(guard.canActivate(ctx)).rejects.toThrow('Invalid or expired token');
  });

  it('attaches req.user with the role embedded in the session token publicMetadata', async () => {
    (verifyToken as jest.Mock).mockResolvedValue({
      sub: 'user_1',
      publicMetadata: { role: Role.ADMIN },
    });
    const req = { headers: { authorization: 'Bearer good-token' } };
    const ctx = contextWith({ req });
    const result = await guard.canActivate(ctx);
    expect(result).toBe(true);
    expect((req as { user?: unknown }).user).toEqual({ userId: 'user_1', role: Role.ADMIN });
    expect(createClerkClient).not.toHaveBeenCalled();
  });

  it('falls back to clerkClient.users.getUser when the token has no embedded role', async () => {
    (verifyToken as jest.Mock).mockResolvedValue({ sub: 'user_2', publicMetadata: {} });
    const getUser = jest.fn().mockResolvedValue({ publicMetadata: { role: Role.VENDOR } });
    (createClerkClient as jest.Mock).mockReturnValue({ users: { getUser } });
    const req = { headers: { authorization: 'Bearer good-token' } };
    const ctx = contextWith({ req });

    await guard.canActivate(ctx);

    expect(getUser).toHaveBeenCalledWith('user_2');
    expect((req as { user?: { role: Role } }).user?.role).toBe(Role.VENDOR);
  });

  it('caches a resolved fallback role for subsequent requests within the TTL', async () => {
    (verifyToken as jest.Mock).mockResolvedValue({ sub: 'user_cache', publicMetadata: {} });
    const getUser = jest.fn().mockResolvedValue({ publicMetadata: { role: Role.RIDER } });
    (createClerkClient as jest.Mock).mockReturnValue({ users: { getUser } });

    const req1 = { headers: { authorization: 'Bearer t1' } };
    await guard.canActivate(contextWith({ req: req1 }));
    const req2 = { headers: { authorization: 'Bearer t2' } };
    await guard.canActivate(contextWith({ req: req2 }));

    expect(getUser).toHaveBeenCalledTimes(1);
    expect((req2 as { user?: { role: Role } }).user?.role).toBe(Role.RIDER);
  });

  it('does not cache an unresolved role (getUser failure) so it retries next time', async () => {
    (verifyToken as jest.Mock).mockResolvedValue({ sub: 'user_retry', publicMetadata: {} });
    const getUser = jest.fn().mockRejectedValue(new Error('clerk down'));
    (createClerkClient as jest.Mock).mockReturnValue({ users: { getUser } });

    const req1 = { headers: { authorization: 'Bearer t1' } };
    await guard.canActivate(contextWith({ req: req1 }));
    expect((req1 as { user?: { role: Role } }).user?.role).toBe(Role.CUSTOMER);

    const req2 = { headers: { authorization: 'Bearer t2' } };
    await guard.canActivate(contextWith({ req: req2 }));

    expect(getUser).toHaveBeenCalledTimes(2);
  });

  it('prunes expired roleCache entries instead of growing unbounded', async () => {
    const nowSpy = jest.spyOn(Date, 'now');
    const getUser = jest.fn().mockResolvedValue({ publicMetadata: { role: Role.RIDER } });
    (createClerkClient as jest.Mock).mockReturnValue({ users: { getUser } });

    nowSpy.mockReturnValue(1_000_000);
    (verifyToken as jest.Mock).mockResolvedValue({ sub: 'user_expiring', publicMetadata: {} });
    await guard.canActivate(contextWith({ req: { headers: { authorization: 'Bearer t1' } } }));
    const sizeBeforeExpiry = getRoleCacheSizeForTesting();

    // advance well past the 60s TTL, then cache-miss for a brand-new user
    nowSpy.mockReturnValue(1_000_000 + 61_000);
    (verifyToken as jest.Mock).mockResolvedValue({ sub: 'user_new', publicMetadata: {} });
    await guard.canActivate(contextWith({ req: { headers: { authorization: 'Bearer t2' } } }));

    // the expired 'user_expiring' entry must have been swept, not just shadowed
    expect(getRoleCacheSizeForTesting()).toBe(sizeBeforeExpiry);

    nowSpy.mockRestore();
  });

  it('defaults to CUSTOMER role when no role can be resolved anywhere', async () => {
    (verifyToken as jest.Mock).mockResolvedValue({ sub: 'user_norole', publicMetadata: {} });
    const getUser = jest.fn().mockResolvedValue({ publicMetadata: {} });
    (createClerkClient as jest.Mock).mockReturnValue({ users: { getUser } });
    const req = { headers: { authorization: 'Bearer t' } };
    await guard.canActivate(contextWith({ req }));
    expect((req as { user?: { role: Role } }).user?.role).toBe(Role.CUSTOMER);
  });

  it('reads the bearer token from graphql-ws connectionParams when there is no HTTP req', async () => {
    (verifyToken as jest.Mock).mockResolvedValue({
      sub: 'user_ws',
      publicMetadata: { role: Role.RIDER },
    });
    const gqlContext: Record<string, unknown> = {
      req: undefined,
      connectionParams: { Authorization: 'Bearer ws-token' },
    };
    const ctx = contextWith(gqlContext);
    const result = await guard.canActivate(ctx);
    expect(result).toBe(true);
    expect(gqlContext.user).toEqual({ userId: 'user_ws', role: Role.RIDER });
  });

  it('reads a lowercase authorization header nested under connectionParams.headers', async () => {
    (verifyToken as jest.Mock).mockResolvedValue({
      sub: 'user_ws2',
      publicMetadata: { role: Role.STORE },
    });
    const gqlContext: Record<string, unknown> = {
      req: undefined,
      connectionParams: { headers: { authorization: 'Bearer ws-token-2' } },
    };
    const ctx = contextWith(gqlContext);
    await guard.canActivate(ctx);
    expect(gqlContext.user).toEqual({ userId: 'user_ws2', role: Role.STORE });
  });

  it('passes authorizedParties parsed from config to verifyToken', async () => {
    config.get.mockReturnValue('https://admin.example.com, https://web.example.com');
    (verifyToken as jest.Mock).mockResolvedValue({
      sub: 'user_ap',
      publicMetadata: { role: Role.ADMIN },
    });
    const req = { headers: { authorization: 'Bearer t' } };
    await guard.canActivate(contextWith({ req }));

    expect(verifyToken).toHaveBeenCalledWith('t', {
      secretKey: 'sk_test_secret',
      authorizedParties: ['https://admin.example.com', 'https://web.example.com'],
    });
  });
});
