import { NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';
import { UsersService } from './users.service';

const query = (resolved: unknown) => ({
  lean: jest.fn().mockReturnThis(),
  exec: jest.fn().mockResolvedValue(resolved),
});

describe('UsersService order-facing lookups', () => {
  const makeService = (userModel: any) =>
    new UsersService(userModel, {} as never, {} as never);

  it('resolves a Mongo user id from Clerk id', async () => {
    const id = new Types.ObjectId();
    const findOne = jest.fn().mockReturnValue(query({ _id: id }));
    const service = makeService({ findOne });

    await expect(service.resolveMongoIdByClerkId('user_1')).resolves.toBe(id);
    expect(findOne).toHaveBeenCalledWith({ clerkId: 'user_1' }, '_id');
  });

  it('throws when a Clerk id has no user', async () => {
    const service = makeService({ findOne: jest.fn().mockReturnValue(query(null)) });

    await expect(service.resolveMongoIdByClerkId('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('resolves a required Clerk id from Mongo id', async () => {
    const id = new Types.ObjectId();
    const findById = jest.fn().mockReturnValue(query({ clerkId: 'user_1' }));
    const service = makeService({ findById });

    await expect(service.resolveClerkIdByMongoId(id)).resolves.toBe('user_1');
    expect(findById).toHaveBeenCalledWith(id, 'clerkId');
  });

  it('returns null for optional Clerk id lookup when missing', async () => {
    const service = makeService({ findById: jest.fn().mockReturnValue(query(null)) });

    await expect(service.findClerkIdByMongoId(new Types.ObjectId())).resolves.toBeNull();
  });
});
