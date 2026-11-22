import { BadRequestException } from '@nestjs/common';
import { assertClerkRolePromotable } from './clerk-role-conflict.util';
import { Role } from './roles.enum';

describe('assertClerkRolePromotable', () => {
  it('allows promoting an email with no existing Clerk role (fresh signup)', () => {
    expect(() => assertClerkRolePromotable(undefined, Role.RIDER, 'invitation')).not.toThrow();
    expect(() => assertClerkRolePromotable(null, Role.RIDER, 'invitation')).not.toThrow();
  });

  it('allows promoting a plain CUSTOMER account to a staff role', () => {
    expect(() => assertClerkRolePromotable('CUSTOMER', Role.VENDOR, 'invitation')).not.toThrow();
  });

  it('allows re-promoting an account that already has the desired role (idempotent retry)', () => {
    expect(() => assertClerkRolePromotable('RIDER', Role.RIDER, 'onboarding')).not.toThrow();
  });

  it('rejects reusing an ADMIN account for a different role', () => {
    expect(() => assertClerkRolePromotable('ADMIN', Role.RIDER, 'onboarding')).toThrow(BadRequestException);
    expect(() => assertClerkRolePromotable('ADMIN', Role.RIDER, 'onboarding')).toThrow(
      /already belongs to a Clerk account with role ADMIN/,
    );
  });

  it('rejects reusing a VENDOR account to create a RIDER', () => {
    expect(() => assertClerkRolePromotable('VENDOR', Role.RIDER, 'onboarding')).toThrow(BadRequestException);
  });

  it('rejects reusing one RIDER account to create a different RIDER (email already claimed by another rider)', () => {
    expect(() => assertClerkRolePromotable('RIDER', Role.STORE, 'onboarding')).toThrow(BadRequestException);
  });

  it('includes the desired role and context in the error message', () => {
    try {
      assertClerkRolePromotable('ADMIN', Role.STORE, 'store creation');
      fail('expected throw');
    } catch (e) {
      expect((e as Error).message).toContain('store creation');
      expect((e as Error).message).toContain('store');
    }
  });
});
