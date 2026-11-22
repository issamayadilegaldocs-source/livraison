import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { hashPassword } from '../common/crypto.util';
import { MoneyCurrency } from '../common/money/money';
import { buildWalletWithdrawalUpdate } from '../common/money/wallet-withdrawal-update';
import { Rider, RiderDocument } from './rider.schema';
import { DayScheduleInput, RiderInput } from './dto/rider.input';

@Injectable()
export class RidersService {
  constructor(
    @InjectModel(Rider.name)
    private readonly riderModel: Model<RiderDocument>,
  ) {}

  findById(id: string): Promise<RiderDocument | null> {
    return this.riderModel
      .findById(id)
      .populate('zone', '_id title')
      .lean()
      .exec() as Promise<RiderDocument | null>;
  }

  findByClerkId(clerkId: string): Promise<RiderDocument | null> {
    return this.riderModel
      .findOne({ clerkId, isActive: true })
      .populate('zone', '_id title')
      .lean()
      .exec() as Promise<RiderDocument | null>;
  }

  /** Batch lookup for dispatch-candidate scoring (see dispatch.service.ts's
   * suggestRidersForOrder) — avoids one findById per nearby-rider candidate. */
  findByIds(ids: string[]): Promise<RiderDocument[]> {
    if (!ids.length) return Promise.resolve([]);
    return this.riderModel
      .find(
        { _id: { $in: ids.map((id) => new Types.ObjectId(id)) }, isActive: true },
        '_id name phone vehicleType available assigned acceptedAssignmentsCount rejectedAssignmentsCount zone lastKnownLocation',
      )
      .lean()
      .exec() as Promise<RiderDocument[]>;
  }

  async resolveMongoIdByClerkId(clerkId: string): Promise<string> {
    const rider = await this.riderModel.findOne({ clerkId }, '_id').lean().exec();
    if (!rider) throw new NotFoundException('Rider not found');
    return String((rider as any)._id);
  }

  async getWalletContext(
    clerkId: string,
  ): Promise<{ id: string; currentWalletAmount: number; currentWalletAmountMinor?: number } | null> {
    const rider = await this.riderModel
      .findOne({ clerkId }, '_id currentWalletAmount currentWalletAmountMinor')
      .lean()
      .exec();
    if (!rider) return null;
    return {
      id: String((rider as any)._id),
      currentWalletAmount: (rider as any).currentWalletAmount ?? 0,
      currentWalletAmountMinor: (rider as any).currentWalletAmountMinor,
    };
  }

  async debitWalletForWithdrawal(
    riderId: string,
    amount: number,
    amountMinor?: number,
    currencyConfig?: MoneyCurrency,
  ): Promise<void> {
    await this.riderModel.findByIdAndUpdate(
      riderId,
      buildWalletWithdrawalUpdate({
        amount,
        amountMinor,
        currencyConfig,
        direction: 'debit',
      }),
    );
  }

  async creditWalletForWithdrawal(
    riderId: string,
    amount: number,
    amountMinor?: number,
    currencyConfig?: MoneyCurrency,
  ): Promise<void> {
    await this.riderModel.findByIdAndUpdate(
      riderId,
      buildWalletWithdrawalUpdate({
        amount,
        amountMinor,
        currencyConfig,
        direction: 'credit',
      }),
    );
  }

  findByUsername(username: string): Promise<RiderDocument | null> {
    return this.riderModel.findOne({ username: username.trim(), isActive: true }).exec();
  }

  /** Raw material for a dispatch-quality signal — with no cost to declining,
   * a rider can cherry-pick only the best orders, degrading dispatch
   * efficiency at peak hours. Called from orders.service.ts's assignOrder
   * (accepted) and rejectRiderAssignment (declined) paths. */
  async recordAssignmentOutcome(riderId: string, outcome: 'accepted' | 'rejected'): Promise<void> {
    const field = outcome === 'accepted' ? 'acceptedAssignmentsCount' : 'rejectedAssignmentsCount';
    await this.riderModel.findByIdAndUpdate(riderId, { $inc: { [field]: 1 } }).exec();
  }

  async findDispatchNotificationTargets({
    riderIds,
    zoneId,
  }: {
    riderIds: string[];
    zoneId?: string;
  }): Promise<{ riderId: string; notificationToken: string }[]> {
    if (!riderIds.length) return [];
    const filter: Record<string, unknown> = {
      _id: { $in: riderIds.map((id) => new Types.ObjectId(id)) },
      available: true,
      isActive: true,
      notificationToken: { $exists: true, $ne: null },
      isOrderNotification: { $ne: false },
    };
    if (zoneId) filter.zone = new Types.ObjectId(zoneId);

    const riders = await this.riderModel.find(filter, 'notificationToken').lean().exec();
    return riders.map((rider: any) => ({
      riderId: String(rider._id),
      notificationToken: rider.notificationToken,
    }));
  }

  findByEmail(email: string): Promise<RiderDocument | null> {
    return this.riderModel.findOne({ email: email.toLowerCase().trim(), isActive: true }).exec();
  }

  async setClerkId(riderId: string, clerkId: string): Promise<RiderDocument> {
    const updated = await this.riderModel
      .findByIdAndUpdate(riderId, { $set: { clerkId } }, { new: true })
      .populate('zone', '_id title')
      .lean()
      .exec();
    if (!updated) throw new NotFoundException('Rider not found');
    return updated as RiderDocument;
  }

  /**
   * Persists the notification token and time zone supplied at login.
   * `rider` may be a lean (plain) object from `findByClerkId`, so we issue an
   * atomic `$set` update rather than mutating-and-saving the document.
   */
  async onLogin(
    rider: RiderDocument,
    { notificationToken, timeZone }: { notificationToken?: string; timeZone?: string },
  ): Promise<void> {
    const update: Partial<Pick<RiderDocument, 'notificationToken' | 'timeZone'>> = {};
    if (notificationToken && rider.notificationToken !== notificationToken) {
      update.notificationToken = notificationToken;
    }
    if (timeZone && rider.timeZone !== timeZone) {
      update.timeZone = timeZone;
    }
    if (Object.keys(update).length === 0) return;
    await this.riderModel.updateOne({ _id: rider._id }, { $set: update }).exec();
  }

  async updateWorkSchedule(
    riderId: string,
    workSchedule: DayScheduleInput[],
    timeZone: string,
  ): Promise<RiderDocument> {
    const updated = await this.riderModel
      .findByIdAndUpdate(riderId, { $set: { workSchedule, timeZone } }, { new: true })
      .populate('zone', '_id title')
      .lean()
      .exec();
    if (!updated) throw new NotFoundException('Rider not found');
    return updated as RiderDocument;
  }

  async toggleAvailability(riderId: string, available: boolean): Promise<void> {
    await this.riderModel.findOneAndUpdate({ clerkId: riderId }, { $set: { available } }).exec();
  }

  async updateNotificationPrefs(
    riderId: string,
    isOrderNotification: boolean,
    isOfferNotification: boolean,
  ): Promise<RiderDocument> {
    const updated = await this.riderModel
      .findByIdAndUpdate(
        riderId,
        { $set: { isOrderNotification, isOfferNotification } },
        { new: true },
      )
      .exec();
    if (!updated) throw new NotFoundException('Rider not found');
    return updated;
  }

  async clearNotificationToken(token: string): Promise<number> {
    const result = await this.riderModel
      .updateMany({ notificationToken: token }, { $unset: { notificationToken: 1 } })
      .exec();
    return result.modifiedCount;
  }

  // ── Admin CRUD ────────────────────────────────────────────────────────────

  findAll(): Promise<RiderDocument[]> {
    return this.riderModel.find().populate('zone', '_id title').lean().exec() as Promise<
      RiderDocument[]
    >;
  }

  findAvailable(): Promise<RiderDocument[]> {
    return this.riderModel
      .find({ available: true, isActive: true })
      .populate('zone', '_id title')
      .lean()
      .exec() as Promise<RiderDocument[]>;
  }

  findByZone(zoneId: string): Promise<RiderDocument[]> {
    return this.riderModel
      .find({ zone: zoneId, isActive: true })
      .populate('zone', '_id title')
      .lean()
      .exec() as Promise<RiderDocument[]>;
  }

  async create(input: RiderInput): Promise<RiderDocument> {
    const plain = input.password ?? Math.random().toString(36).slice(-8);
    const hashed = await hashPassword(plain);
    const doc = await this.riderModel.create({
      name: input.name,
      username: input.username,
      password: hashed,
      email: input.email,
      phone: input.phone,
      image: input.image,
      timeZone: input.timeZone,
      available: input.available ?? false,
      isActive: input.isActive ?? true,
      accountNumber: input.accountNumber,
      vehicleType: input.vehicleType,
      zone: input.zone,
    });
    return doc.populate('zone', '_id title');
  }

  async edit(input: RiderInput): Promise<RiderDocument> {
    if (!input._id) throw new NotFoundException('_id is required');
    const patch: Record<string, unknown> = {};
    if (input.name !== undefined) patch.name = input.name;
    if (input.username !== undefined) patch.username = input.username;
    if (input.email !== undefined) patch.email = input.email;
    if (input.phone !== undefined) patch.phone = input.phone;
    if (input.image !== undefined) patch.image = input.image;
    if (input.timeZone !== undefined) patch.timeZone = input.timeZone;
    if (input.available !== undefined) patch.available = input.available;
    if (input.isActive !== undefined) patch.isActive = input.isActive;
    if (input.accountNumber !== undefined) patch.accountNumber = input.accountNumber;
    if (input.vehicleType !== undefined) patch.vehicleType = input.vehicleType;
    if (input.zone !== undefined) patch.zone = input.zone;
    if (input.password) patch.password = await hashPassword(input.password);

    const updated = await this.riderModel
      .findByIdAndUpdate(input._id, { $set: patch }, { new: true })
      .populate('zone', '_id title')
      .lean()
      .exec();
    if (!updated) throw new NotFoundException('Rider not found');
    return updated as RiderDocument;
  }

  async deleteRider(id: string): Promise<RiderDocument> {
    const updated = await this.riderModel
      .findByIdAndUpdate(id, { $set: { isActive: false } }, { new: true })
      .lean()
      .exec();
    if (!updated) throw new NotFoundException('Rider not found');
    return updated as RiderDocument;
  }

  async toggleAvailablity(id: string): Promise<RiderDocument> {
    const rider = await this.riderModel.findById(id).exec();
    if (!rider) throw new NotFoundException('Rider not found');
    rider.available = !rider.available;
    await rider.save();
    return rider.toObject() as RiderDocument;
  }

  async updateLicenseDetails(
    id: string,
    licenseDetails: Record<string, unknown>,
  ): Promise<RiderDocument> {
    const updated = await this.riderModel
      .findByIdAndUpdate(id, { $set: { licenseDetails } }, { new: true })
      .lean()
      .exec();
    if (!updated) throw new NotFoundException('Rider not found');
    return updated as RiderDocument;
  }

  async updateVehicleDetails(
    id: string,
    vehicleDetails: Record<string, unknown>,
  ): Promise<RiderDocument> {
    const updated = await this.riderModel
      .findByIdAndUpdate(id, { $set: { vehicleDetails } }, { new: true })
      .lean()
      .exec();
    if (!updated) throw new NotFoundException('Rider not found');
    return updated as RiderDocument;
  }

  async updateBussinessDetails(
    id: string,
    bussinessDetails: Record<string, unknown>,
  ): Promise<RiderDocument> {
    const updated = await this.riderModel
      .findByIdAndUpdate(id, { $set: { bussinessDetails } }, { new: true })
      .lean()
      .exec();
    if (!updated) throw new NotFoundException('Rider not found');
    return updated as RiderDocument;
  }

  async findByEmailOrThrow(email: string): Promise<RiderDocument> {
    const rider = await this.riderModel.findOne({ email }).lean().exec();
    if (!rider) throw new NotFoundException('Rider not found');
    return rider as RiderDocument;
  }
}
