import { BadRequestException } from '@nestjs/common';
import { Webhook } from 'svix';
import { ClerkWebhookController } from './clerk-webhook.controller';

jest.mock('svix', () => ({
  Webhook: jest.fn(),
}));

describe('ClerkWebhookController', () => {
  const config = { getOrThrow: jest.fn().mockReturnValue('whsec_test') };
  let usersService: { findOrCreateByClerkId: jest.Mock; deactivateByClerkId: jest.Mock };
  let ownersService: { findOrCreateByClerkId: jest.Mock; deactivateByClerkId: jest.Mock };
  let verify: jest.Mock;
  let controller: ClerkWebhookController;

  const req = (rawBody: Buffer) => ({ rawBody }) as never;
  const headers = { svixId: 'msg_1', svixTimestamp: '123', svixSignature: 'v1,sig' };

  beforeEach(() => {
    jest.clearAllMocks();
    verify = jest.fn();
    (Webhook as unknown as jest.Mock).mockImplementation(() => ({ verify }));
    usersService = {
      findOrCreateByClerkId: jest.fn().mockResolvedValue(undefined),
      deactivateByClerkId: jest.fn().mockResolvedValue(undefined),
    };
    ownersService = {
      findOrCreateByClerkId: jest.fn().mockResolvedValue(undefined),
      deactivateByClerkId: jest.fn().mockResolvedValue(undefined),
    };
    controller = new ClerkWebhookController(
      config as never,
      usersService as never,
      ownersService as never,
    );
  });

  it('rejects a request whose signature does not verify', async () => {
    verify.mockImplementation(() => {
      throw new Error('bad signature');
    });
    await expect(
      controller.handle(req(Buffer.from('{}')), headers.svixId, headers.svixTimestamp, headers.svixSignature),
    ).rejects.toThrow(BadRequestException);
    expect(usersService.findOrCreateByClerkId).not.toHaveBeenCalled();
    expect(ownersService.findOrCreateByClerkId).not.toHaveBeenCalled();
  });

  it('constructs the Webhook verifier with the configured secret and verifies with the svix headers', async () => {
    verify.mockReturnValue({
      type: 'user.created',
      data: { id: 'clerk_1', email_addresses: [{ email_address: 'a@b.com' }], phone_numbers: [] },
    });
    await controller.handle(req(Buffer.from('{}')), headers.svixId, headers.svixTimestamp, headers.svixSignature);
    expect(Webhook).toHaveBeenCalledWith('whsec_test');
    expect(verify).toHaveBeenCalledWith(expect.any(Buffer), {
      'svix-id': headers.svixId,
      'svix-timestamp': headers.svixTimestamp,
      'svix-signature': headers.svixSignature,
    });
  });

  it('routes a customer (no role / CUSTOMER role) user.created event to UsersService', async () => {
    verify.mockReturnValue({
      type: 'user.created',
      data: {
        id: 'clerk_customer',
        email_addresses: [{ email_address: 'cust@example.com' }],
        phone_numbers: [{ phone_number: '+21611111111' }],
        first_name: 'Jane',
        last_name: 'Doe',
        public_metadata: {},
      },
    });
    await controller.handle(req(Buffer.from('{}')), headers.svixId, headers.svixTimestamp, headers.svixSignature);
    expect(usersService.findOrCreateByClerkId).toHaveBeenCalledWith('clerk_customer', {
      email: 'cust@example.com',
      phone: '+21611111111',
      name: 'Jane Doe',
    });
    expect(ownersService.findOrCreateByClerkId).not.toHaveBeenCalled();
  });

  it('routes an ADMIN role user.updated event to OwnersService', async () => {
    verify.mockReturnValue({
      type: 'user.updated',
      data: {
        id: 'clerk_admin',
        email_addresses: [{ email_address: 'admin@example.com' }],
        phone_numbers: [],
        public_metadata: { role: 'ADMIN' },
      },
    });
    await controller.handle(req(Buffer.from('{}')), headers.svixId, headers.svixTimestamp, headers.svixSignature);
    expect(ownersService.findOrCreateByClerkId).toHaveBeenCalledWith('clerk_admin', {
      email: 'admin@example.com',
      name: undefined,
      userType: 'ADMIN',
    });
    expect(usersService.findOrCreateByClerkId).not.toHaveBeenCalled();
  });

  it('routes a VENDOR role user.created event to OwnersService', async () => {
    verify.mockReturnValue({
      type: 'user.created',
      data: {
        id: 'clerk_vendor',
        email_addresses: [{ email_address: 'vendor@example.com' }],
        phone_numbers: [],
        public_metadata: { role: 'VENDOR' },
      },
    });
    await controller.handle(req(Buffer.from('{}')), headers.svixId, headers.svixTimestamp, headers.svixSignature);
    expect(ownersService.findOrCreateByClerkId).toHaveBeenCalledWith('clerk_vendor', {
      email: 'vendor@example.com',
      name: undefined,
      userType: 'VENDOR',
    });
  });

  it('does not provision anything for STORE/RIDER roles (pre-created by admin, linked separately)', async () => {
    verify.mockReturnValue({
      type: 'user.created',
      data: {
        id: 'clerk_rider',
        email_addresses: [{ email_address: 'rider@example.com' }],
        phone_numbers: [],
        public_metadata: { role: 'RIDER' },
      },
    });
    await controller.handle(req(Buffer.from('{}')), headers.svixId, headers.svixTimestamp, headers.svixSignature);
    expect(usersService.findOrCreateByClerkId).not.toHaveBeenCalled();
    expect(ownersService.findOrCreateByClerkId).not.toHaveBeenCalled();
  });

  it('deactivates both user and owner records on user.deleted (identity type unknown to this webhook)', async () => {
    verify.mockReturnValue({
      type: 'user.deleted',
      data: { id: 'clerk_gone', email_addresses: [], phone_numbers: [] },
    });
    await controller.handle(req(Buffer.from('{}')), headers.svixId, headers.svixTimestamp, headers.svixSignature);
    expect(usersService.deactivateByClerkId).toHaveBeenCalledWith('clerk_gone');
    expect(ownersService.deactivateByClerkId).toHaveBeenCalledWith('clerk_gone');
  });

  it('does not let one deactivation failure prevent the other (Promise.allSettled)', async () => {
    verify.mockReturnValue({
      type: 'user.deleted',
      data: { id: 'clerk_gone2', email_addresses: [], phone_numbers: [] },
    });
    usersService.deactivateByClerkId.mockRejectedValue(new Error('db down'));
    await expect(
      controller.handle(req(Buffer.from('{}')), headers.svixId, headers.svixTimestamp, headers.svixSignature),
    ).resolves.toEqual({ received: true });
    expect(ownersService.deactivateByClerkId).toHaveBeenCalledWith('clerk_gone2');
  });

  it('ignores unhandled event types without throwing', async () => {
    verify.mockReturnValue({ type: 'session.created', data: { id: 'x', email_addresses: [], phone_numbers: [] } });
    await expect(
      controller.handle(req(Buffer.from('{}')), headers.svixId, headers.svixTimestamp, headers.svixSignature),
    ).resolves.toEqual({ received: true });
  });
});
