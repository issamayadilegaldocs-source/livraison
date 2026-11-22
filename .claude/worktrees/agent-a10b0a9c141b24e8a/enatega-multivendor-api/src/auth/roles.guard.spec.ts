import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';
import { Role } from './roles.enum';

function contextWith(gqlContext: Record<string, unknown>): ExecutionContext {
  return {
    getType: () => 'graphql',
    getClass: () => ({}),
    getHandler: () => ({}),
    getArgs: () => [undefined, undefined, gqlContext, undefined],
  } as unknown as ExecutionContext;
}

describe('RolesGuard', () => {
  const buildGuard = (required: Role[] | undefined) => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(required) } as unknown as Reflector;
    return new RolesGuard(reflector);
  };

  it('denies by default when the handler declares no @Roles()', () => {
    const guard = buildGuard(undefined);
    const ctx = contextWith({ req: { user: { userId: 'u1', role: Role.ADMIN } } });
    expect(guard.canActivate(ctx)).toBe(false);
  });

  it('denies when @Roles() is an empty array', () => {
    const guard = buildGuard([]);
    const ctx = contextWith({ req: { user: { userId: 'u1', role: Role.ADMIN } } });
    expect(guard.canActivate(ctx)).toBe(false);
  });

  it('denies when there is no authenticated user on the context', () => {
    const guard = buildGuard([Role.ADMIN]);
    const ctx = contextWith({ req: { user: undefined } });
    expect(() => guard.canActivate(ctx)).toThrow('Insufficient role');
  });

  it('denies when the actor role is not in the required list', () => {
    const guard = buildGuard([Role.ADMIN]);
    const ctx = contextWith({ req: { user: { userId: 'u1', role: Role.RIDER } } });
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('allows when the actor role matches one of the required roles', () => {
    const guard = buildGuard([Role.ADMIN, Role.VENDOR]);
    const ctx = contextWith({ req: { user: { userId: 'u1', role: Role.VENDOR } } });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('reads the user from the WebSocket gqlContext when there is no HTTP req', () => {
    const guard = buildGuard([Role.RIDER]);
    const ctx = contextWith({ req: undefined, user: { userId: 'u2', role: Role.RIDER } });
    expect(guard.canActivate(ctx)).toBe(true);
  });
});
