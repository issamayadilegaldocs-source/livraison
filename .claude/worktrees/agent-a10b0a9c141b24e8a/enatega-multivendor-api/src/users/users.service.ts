import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClerkClient } from '@clerk/backend';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CreateUserInput } from './dto/create-user.input';
import { UpdateUserInput } from './dto/update-user.input';
import { AddressInput } from './dto/address.input';
import { User, UserDocument } from './user.schema';
import { Order, OrderDocument } from '../orders/order.schema';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    @InjectModel(Order.name)
    private readonly orderModel: Model<OrderDocument>,
    private readonly config: ConfigService,
  ) {}

  findById(id: string): Promise<UserDocument | null> {
    return this.userModel.findById(id).exec();
  }

  findByClerkId(clerkId: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ clerkId }).exec();
  }

  async resolveMongoIdByClerkId(clerkId: string): Promise<Types.ObjectId> {
    const user = await this.userModel.findOne({ clerkId }, '_id').lean().exec();
    if (!user) throw new NotFoundException('User not found');
    return (user as any)._id as Types.ObjectId;
  }

  async resolveClerkIdByMongoId(userId: string | Types.ObjectId): Promise<string> {
    const clerkId = await this.findClerkIdByMongoId(userId);
    if (!clerkId) throw new NotFoundException('User not found for order');
    return clerkId;
  }

  async findClerkIdByMongoId(userId: string | Types.ObjectId): Promise<string | null> {
    const user = await this.userModel.findById(userId, 'clerkId').lean().exec();
    return (user as any)?.clerkId ?? null;
  }

  async findOrCreateByClerkId(
    clerkId: string,
    data: Partial<Pick<User, 'email' | 'phone' | 'name'>>,
  ): Promise<UserDocument> {
    return this.userModel.findOneAndUpdate(
      { clerkId },
      { $setOnInsert: { clerkId, ...data, userType: 'default' } },
      { upsert: true, new: true },
    );
  }

  async deactivateByClerkId(clerkId: string): Promise<void> {
    await this.userModel.updateOne({ clerkId }, { $set: { isActive: false } }).exec();
  }

  findByEmail(email: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ email: email.toLowerCase().trim() }).exec();
  }

  findByPhone(phone: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ phone: phone.trim() }).exec();
  }

  findByAppleId(appleId: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ appleId }).exec();
  }

  async create(
    input: CreateUserInput & { userType?: string },
  ): Promise<UserDocument> {
    return this.userModel.create({
      name: input.name,
      email: input.email,
      phone: input.phone,
      appleId: input.appleId,
      notificationToken: input.notificationToken,
      userType: input.userType ?? 'default',
      emailIsVerified: input.emailIsVerified ?? false,
    });
  }

  async setNotificationToken(
    user: UserDocument,
    token?: string,
  ): Promise<void> {
    if (token && user.notificationToken !== token) {
      user.notificationToken = token;
      await user.save();
    }
  }

  // ── profile ────────────────────────────────────────────────────────────────

  async getProfile(userId: string): Promise<UserDocument> {
    const user = await this.userModel.findOne({ clerkId: userId }).exec();
    if (!user) {
      return this.createProfileFromClerk(userId);
    }
    return user;
  }

  private async createProfileFromClerk(clerkId: string): Promise<UserDocument> {
    try {
      const secretKey = this.config.getOrThrow<string>('CLERK_SECRET_KEY');
      const clerk = createClerkClient({ secretKey });
      const clerkUser = await clerk.users.getUser(clerkId);
      const email = clerkUser.emailAddresses[0]?.emailAddress;
      const phone = clerkUser.phoneNumbers[0]?.phoneNumber;
      const name =
        [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(' ') ||
        clerkUser.username ||
        undefined;

      return this.findOrCreateByClerkId(clerkId, { email, phone, name });
    } catch {
      throw new NotFoundException('User not found');
    }
  }

  async updateUser(
    userId: string,
    input: UpdateUserInput,
  ): Promise<UserDocument> {
    const patch: Record<string, unknown> = { name: input.name };
    if (input.phone !== undefined) patch.phone = input.phone;
    if (input.preferredLanguage !== undefined) patch.preferredLanguage = input.preferredLanguage;

    const updated = await this.userModel
      .findOneAndUpdate({ clerkId: userId }, { $set: patch }, { new: true })
      .exec();
    if (!updated) throw new NotFoundException('User not found');
    return updated;
  }

  // ── addresses ─────────────────────────────────────────────────────────────

  async createAddress(
    userId: string,
    input: AddressInput,
  ): Promise<UserDocument> {
    const coordinates =
      input.location?.coordinates ??
      (input.longitude !== undefined && input.latitude !== undefined
        ? [Number(input.longitude), Number(input.latitude)]
        : undefined);
    const location = coordinates ? { type: 'Point', coordinates } : undefined;

    if (input.selected) {
      await this.userModel
        .updateOne(
          { clerkId: userId },
          { $set: { 'addresses.$[].selected': false } },
        )
        .exec();
    }

    const updated = await this.userModel
      .findOneAndUpdate(
        { clerkId: userId },
        {
          $push: {
            addresses: {
              _id: new Types.ObjectId(),
              label: input.label,
              deliveryAddress: input.deliveryAddress,
              details: input.details,
              location,
              selected: input.selected ?? false,
            },
          },
        },
        { new: true },
      )
      .exec();
    if (!updated) throw new NotFoundException('User not found');
    return updated;
  }

  async editAddress(
    userId: string,
    input: AddressInput,
  ): Promise<UserDocument> {
    if (!input._id) throw new BadRequestException('Address _id is required');

    if (input.selected) {
      await this.userModel
        .updateOne(
          { clerkId: userId },
          { $set: { 'addresses.$[].selected': false } },
        )
        .exec();
    }

    const patch: Record<string, unknown> = {};
    if (input.label !== undefined) patch['addresses.$[addr].label'] = input.label;
    if (input.deliveryAddress !== undefined)
      patch['addresses.$[addr].deliveryAddress'] = input.deliveryAddress;
    if (input.details !== undefined)
      patch['addresses.$[addr].details'] = input.details;
    const coordinates =
      input.location?.coordinates ??
      (input.longitude !== undefined && input.latitude !== undefined
        ? [Number(input.longitude), Number(input.latitude)]
        : undefined);
    if (coordinates !== undefined)
      patch['addresses.$[addr].location'] = {
        type: 'Point',
        coordinates,
      };
    if (input.selected !== undefined)
      patch['addresses.$[addr].selected'] = input.selected;

    const updated = await this.userModel
      .findOneAndUpdate(
        { clerkId: userId },
        { $set: patch },
        {
          new: true,
          arrayFilters: [{ 'addr._id': new Types.ObjectId(input._id) }],
        },
      )
      .exec();
    if (!updated) throw new NotFoundException('User not found');
    return updated;
  }

  async deleteAddress(
    userId: string,
    addressId: string,
  ): Promise<UserDocument> {
    const updated = await this.userModel
      .findOneAndUpdate(
        { clerkId: userId },
        { $pull: { addresses: { _id: new Types.ObjectId(addressId) } } },
        { new: true },
      )
      .exec();
    if (!updated) throw new NotFoundException('User not found');
    return updated;
  }

  async deleteBulkAddresses(
    userId: string,
    ids: string[],
  ): Promise<UserDocument> {
    const objectIds = ids.map((id) => new Types.ObjectId(id));
    const updated = await this.userModel
      .findOneAndUpdate(
        { clerkId: userId },
        { $pull: { addresses: { _id: { $in: objectIds } } } },
        { new: true },
      )
      .exec();
    if (!updated) throw new NotFoundException('User not found');
    return updated;
  }

  async selectAddress(
    userId: string,
    addressId: string,
  ): Promise<UserDocument> {
    await this.userModel
      .updateOne({ clerkId: userId }, { $set: { 'addresses.$[].selected': false } })
      .exec();
    const updated = await this.userModel
      .findOneAndUpdate(
        { clerkId: userId },
        { $set: { 'addresses.$[addr].selected': true } },
        { new: true, arrayFilters: [{ 'addr._id': new Types.ObjectId(addressId) }] },
      )
      .exec();
    if (!updated) throw new NotFoundException('User not found');
    return updated;
  }

  // ── favourites ────────────────────────────────────────────────────────────

  async toggleFavourite(
    userId: string,
    restaurantId: string,
  ): Promise<UserDocument> {
    const user = await this.userModel.findOne({ clerkId: userId }).exec();
    if (!user) throw new NotFoundException('User not found');

    const already = (user.favourite ?? []).includes(restaurantId);
    const updated = await this.userModel
      .findOneAndUpdate(
        { clerkId: userId },
        already
          ? { $pull: { favourite: restaurantId } }
          : { $addToSet: { favourite: restaurantId } },
        { new: true },
      )
      .exec();
    return updated!;
  }

  async getFavouriteIds(userId: string): Promise<string[]> {
    const user = await this.userModel
      .findOne({ clerkId: userId }, 'favourite')
      .lean()
      .exec();
    return (user?.favourite as string[]) ?? [];
  }

  // ── admin ops ─────────────────────────────────────────────────────────────

  findAll(): Promise<UserDocument[]> {
    return this.userModel.find().exec();
  }

  async updateStatus(
    id: string,
    status: string,
    _reason?: string,
  ): Promise<UserDocument> {
    const updated = await this.userModel
      .findByIdAndUpdate(id, { $set: { status } }, { new: true })
      .exec();
    if (!updated) throw new NotFoundException('User not found');
    return updated;
  }

  async updateNotes(id: string, notes: string): Promise<UserDocument> {
    const updated = await this.userModel
      .findByIdAndUpdate(id, { $set: { notes } }, { new: true })
      .exec();
    if (!updated) throw new NotFoundException('User not found');
    return updated;
  }

  async deleteOne(id: string): Promise<UserDocument> {
    // Referential integrity: keep order history intact — block hard delete when
    // the customer has placed orders; the account should be deactivated instead.
    const orderCount = await this.orderModel
      .countDocuments({ user: new Types.ObjectId(id) })
      .exec();
    if (orderCount > 0) {
      throw new ConflictException(
        `Cannot delete this user because they have ${orderCount} order${orderCount === 1 ? '' : 's'} in their history. Deactivate the account instead.`,
      );
    }

    const deleted = await this.userModel.findByIdAndDelete(id).exec();
    if (!deleted) throw new NotFoundException('User not found');
    return deleted;
  }

  async resetSession(userId: string): Promise<UserDocument> {
    const updated = await this.userModel
      .findByIdAndUpdate(
        userId,
        { $unset: { notificationToken: 1 } },
        { new: true },
      )
      .exec();
    if (!updated) throw new NotFoundException('User not found');
    return updated;
  }

  async clearNotificationToken(token: string): Promise<number> {
    const result = await this.userModel
      .updateMany({ notificationToken: token }, { $unset: { notificationToken: 1 } })
      .exec();
    return result.modifiedCount;
  }

  async updateNotificationPrefs(
    userId: string,
    isOrderNotification: boolean,
    isOfferNotification: boolean,
  ): Promise<UserDocument> {
    const updated = await this.userModel
      .findByIdAndUpdate(
        userId,
        { $set: { isOrderNotification, isOfferNotification } },
        { new: true },
      )
      .exec();
    if (!updated) throw new NotFoundException('User not found');
    return updated;
  }

  async deactivateByEmail(email: string, isActive: boolean): Promise<UserDocument> {
    const updated = await this.userModel
      .findOneAndUpdate(
        { email: email.toLowerCase().trim() },
        { $set: { isActive } },
        { new: true },
      )
      .exec();
    if (!updated) throw new NotFoundException('User not found');
    return updated;
  }
}
