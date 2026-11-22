import { BadRequestException, ConflictException } from '@nestjs/common';
import { createClerkClient } from '@clerk/backend';
import { OwnersService } from './owners.service';

// OwnersService builds a Clerk client lazily via `this.clerk()`, which calls
// `createClerkClient` on every use. Mocking the factory lets each test return a
// shared, fully stubbed client and assert exactly which Clerk calls were made.
jest.mock('@clerk/backend', () => ({
  createClerkClient: jest.fn(),
}));

/** Chainable Mongoose query stub resolving to `resolved` from `.exec()`. */
const query = (resolved: unknown) => ({
  populate: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  lean: jest.fn().mockReturnThis(),
  exec: jest.fn().mockResolvedValue(resolved),
});

describe('OwnersService', () => {
  const config = { getOrThrow: jest.fn().mockReturnValue('sk_test_secret'), get: jest.fn() };

  let clerk: {
    users: {
      createUser: jest.Mock;
      updateUser: jest.Mock;
      getUser: jest.Mock;
      getUserList: jest.Mock;
      updateUserMetadata: jest.Mock;
    };
    emailAddresses: { createEmailAddress: jest.Mock; deleteEmailAddress: jest.Mock };
  };

  beforeEach(() => {
    jest.clearAllMocks();
    clerk = {
      users: {
        createUser: jest.fn(),
        updateUser: jest.fn().mockResolvedValue(undefined),
        getUser: jest.fn(),
        getUserList: jest.fn().mockResolvedValue({ data: [] }),
        updateUserMetadata: jest.fn().mockResolvedValue(undefined),
      },
      emailAddresses: {
        createEmailAddress: jest.fn(),
        deleteEmailAddress: jest.fn().mockResolvedValue(undefined),
      },
    };
    (createClerkClient as jest.Mock).mockReturnValue(clerk);
  });

  // ── splitName, exercised through createVendor ──────────────────────────────
  describe('createVendor name resolution', () => {
    const buildService = () => {
      const create = jest.fn((doc) => Promise.resolve({ _id: 'owner_1', ...doc }));
      const ownerModel = { create };
      const service = new OwnersService(ownerModel as never, {} as never, config as never);
      return { service, create };
    };

    it('derives firstName/lastName from a full name when none are given', async () => {
      clerk.users.createUser.mockResolvedValue({ id: 'user_new' });
      const { service, create } = buildService();

      await service.createVendor({ email: 'Vendor@Example.com', name: 'John Doe' });

      expect(create).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'vendor@example.com',
          firstName: 'John',
          lastName: 'Doe',
          clerkId: 'user_new',
        }),
      );
    });

    it('keeps a single-word name as firstName with no lastName', async () => {
      clerk.users.createUser.mockResolvedValue({ id: 'user_new' });
      const { service, create } = buildService();

      await service.createVendor({ email: 'cher@example.com', name: 'Cher' });

      const [doc] = create.mock.calls[0];
      expect(doc.firstName).toBe('Cher');
      expect(doc.lastName).toBeUndefined();
    });

    it('prefers explicit firstName/lastName over the full name', async () => {
      clerk.users.createUser.mockResolvedValue({ id: 'user_new' });
      const { service, create } = buildService();

      await service.createVendor({
        email: 'jane@example.com',
        name: 'John Doe',
        firstName: 'Jane',
        lastName: 'Air',
      });

      expect(create).toHaveBeenCalledWith(
        expect.objectContaining({ firstName: 'Jane', lastName: 'Air' }),
      );
    });

    it('falls back to a Mongo-only record when Clerk provisioning fails', async () => {
      clerk.users.createUser.mockRejectedValue(new Error('clerk down'));
      const { service, create } = buildService();

      await service.createVendor({ email: 'vendor@example.com', name: 'John Doe' });

      // Clerk outages must not break admin CRUD — the owner is still created,
      // just without a clerkId link.
      const [doc] = create.mock.calls[0];
      expect(doc).not.toHaveProperty('clerkId');
    });
  });

  // ── findById back-fills names for vendors that predate firstName/lastName ───
  describe('findById', () => {
    it('derives firstName/lastName on read for legacy owners with only `name`', async () => {
      const ownerId = '6a3fac2f0756484e74658505';
      const ownerModel = {
        findById: jest.fn().mockReturnValue(
          query({ _id: ownerId, name: 'Jane Smith', email: 'jane@example.com' }),
        ),
      };
      const restaurantModel = { find: jest.fn().mockReturnValue(query([])) };
      const service = new OwnersService(ownerModel as never, restaurantModel as never, config as never);

      const owner = await service.findById(ownerId);

      expect(owner).toMatchObject({ firstName: 'Jane', lastName: 'Smith' });
    });
  });

  // ── syncClerkVendor, exercised through editVendor ──────────────────────────
  describe('editVendor Clerk sync', () => {
    const buildService = (existing: Record<string, unknown>) => {
      const findByIdAndUpdate = jest
        .fn()
        .mockReturnValue(query({ _id: existing._id, ...existing }));
      const ownerModel = {
        findById: jest.fn().mockReturnValue(query(existing)),
        findByIdAndUpdate,
      };
      const service = new OwnersService(ownerModel as never, {} as never, config as never);
      return { service, findByIdAndUpdate };
    };

    it('throws and does not touch Mongo when the Clerk password update fails', async () => {
      clerk.users.updateUser.mockRejectedValue({
        errors: [{ longMessage: 'password too weak' }],
      });
      const { service, findByIdAndUpdate } = buildService({
        _id: 'owner_1',
        email: 'old@example.com',
        clerkId: 'user_a',
      });

      await expect(
        service.editVendor({ _id: 'owner_1', password: 'new-secret' }),
      ).rejects.toBeInstanceOf(BadRequestException);
      // A password change that never reached Clerk would silently lock the
      // vendor out — Mongo must not record a "successful" edit.
      expect(findByIdAndUpdate).not.toHaveBeenCalled();
    });

    it('surfaces the Clerk error detail in the thrown message', async () => {
      clerk.users.updateUser.mockRejectedValue({
        errors: [{ longMessage: 'password too weak' }],
      });
      const { service } = buildService({ _id: 'owner_1', email: 'old@example.com', clerkId: 'user_a' });

      await expect(
        service.editVendor({ _id: 'owner_1', password: 'x' }),
      ).rejects.toThrow(/password too weak/);
    });

    it('rejects an email already owned by a different Clerk account', async () => {
      clerk.users.getUserList.mockResolvedValue({ data: [{ id: 'user_b' }] });
      const { service, findByIdAndUpdate } = buildService({
        _id: 'owner_1',
        email: 'old@example.com',
        clerkId: 'user_a',
      });

      await expect(
        service.editVendor({ _id: 'owner_1', email: 'taken@example.com' }),
      ).rejects.toBeInstanceOf(ConflictException);
      // Abort before the address is created and before Mongo diverges from Clerk.
      expect(clerk.users.getUser).not.toHaveBeenCalled();
      expect(clerk.emailAddresses.createEmailAddress).not.toHaveBeenCalled();
      expect(findByIdAndUpdate).not.toHaveBeenCalled();
    });

    it('adds the new email as a verified primary and drops the old ones', async () => {
      clerk.users.getUserList.mockResolvedValue({ data: [] });
      clerk.users.getUser.mockResolvedValue({
        emailAddresses: [{ id: 'em_old', emailAddress: 'old@example.com' }],
      });
      clerk.emailAddresses.createEmailAddress.mockResolvedValue({ id: 'em_new' });
      const { service, findByIdAndUpdate } = buildService({
        _id: 'owner_1',
        email: 'old@example.com',
        clerkId: 'user_a',
      });

      await service.editVendor({ _id: 'owner_1', email: 'new@example.com' });

      expect(clerk.emailAddresses.createEmailAddress).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user_a',
          emailAddress: 'new@example.com',
          primary: true,
          verified: true,
        }),
      );
      expect(clerk.emailAddresses.deleteEmailAddress).toHaveBeenCalledWith('em_old');
      expect(clerk.emailAddresses.deleteEmailAddress).not.toHaveBeenCalledWith('em_new');
      expect(findByIdAndUpdate).toHaveBeenCalled();
    });

    it('is idempotent when the new email is already on the same Clerk user (retry)', async () => {
      // A prior attempt already attached the address; the conflict lookup returns
      // the same user, which is allowed.
      clerk.users.getUserList.mockResolvedValue({ data: [{ id: 'user_a' }] });
      clerk.users.getUser.mockResolvedValue({
        emailAddresses: [
          { id: 'em_old', emailAddress: 'old@example.com' },
          { id: 'em_new', emailAddress: 'new@example.com' },
        ],
      });
      const { service, findByIdAndUpdate } = buildService({
        _id: 'owner_1',
        email: 'old@example.com',
        clerkId: 'user_a',
      });

      await service.editVendor({ _id: 'owner_1', email: 'new@example.com' });

      // No duplicate address is created; the existing one is promoted to primary.
      expect(clerk.emailAddresses.createEmailAddress).not.toHaveBeenCalled();
      expect(clerk.users.updateUser).toHaveBeenCalledWith('user_a', {
        primaryEmailAddressID: 'em_new',
      });
      expect(clerk.emailAddresses.deleteEmailAddress).toHaveBeenCalledWith('em_old');
      expect(clerk.emailAddresses.deleteEmailAddress).not.toHaveBeenCalledWith('em_new');
      expect(findByIdAndUpdate).toHaveBeenCalled();
    });

    it('throws when applying the email change in Clerk fails', async () => {
      clerk.users.getUserList.mockResolvedValue({ data: [] });
      clerk.users.getUser.mockResolvedValue({
        emailAddresses: [{ id: 'em_old', emailAddress: 'old@example.com' }],
      });
      clerk.emailAddresses.createEmailAddress.mockRejectedValue({
        errors: [{ message: 'rate limited' }],
      });
      const { service, findByIdAndUpdate } = buildService({
        _id: 'owner_1',
        email: 'old@example.com',
        clerkId: 'user_a',
      });

      await expect(
        service.editVendor({ _id: 'owner_1', email: 'new@example.com' }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(findByIdAndUpdate).not.toHaveBeenCalled();
    });

    it('skips Clerk entirely when neither password nor email changes', async () => {
      const { service, findByIdAndUpdate } = buildService({
        _id: 'owner_1',
        email: 'old@example.com',
        clerkId: 'user_a',
      });

      await service.editVendor({ _id: 'owner_1', name: 'Renamed Vendor' });

      expect(clerk.users.updateUser).not.toHaveBeenCalled();
      expect(clerk.users.getUserList).not.toHaveBeenCalled();
      expect(findByIdAndUpdate).toHaveBeenCalled();
    });
  });
});
