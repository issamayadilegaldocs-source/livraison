import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type RiderDocument = HydratedDocument<Rider>;

@Schema({ _id: false })
class GeoPoint {
  @Prop({ required: true, enum: ['Point'] }) type!: 'Point';
  @Prop({ type: [Number], required: true }) coordinates!: [number, number];
}

@Schema({ _id: false })
class BussinessDetails {
  @Prop() bankName?: string;
  @Prop() accountName?: string;
  @Prop() accountCode?: string;
  @Prop() accountNumber?: string;
  @Prop() bussinessRegNo?: string;
  @Prop() companyRegNo?: string;
  @Prop() taxRate?: string;
}

@Schema({ _id: false })
class LicenseDetails {
  @Prop() number?: string;
  @Prop() expiryDate?: string;
  @Prop() image?: string;
}

@Schema({ _id: false })
class VehicleDetails {
  @Prop() number?: string;
  @Prop() image?: string;
}

@Schema({ _id: false })
class TimeSlot {
  @Prop({ required: true }) startTime!: string;
  @Prop({ required: true }) endTime!: string;
}

@Schema({ _id: false })
class DaySchedule {
  @Prop({ required: true }) day!: string;
  @Prop({ default: false }) enabled!: boolean;
  @Prop({ type: [TimeSlot], default: [] }) slots!: TimeSlot[];
}

@Schema({ collection: 'riders', timestamps: true })
export class Rider {
  @Prop() name?: string;

  @Prop({ trim: true, index: true }) username?: string;

  @Prop({ select: false }) password?: string;

  @Prop({ type: String, index: true, sparse: true }) clerkId?: string;

  @Prop() email?: string;

  @Prop() phone?: string;

  @Prop() image?: string;

  @Prop() timeZone?: string;

  @Prop({ index: true, sparse: true }) notificationToken?: string;

  @Prop({ default: false }) available?: boolean;

  @Prop({ default: true }) isActive?: boolean;

  @Prop({ default: false }) assigned?: boolean;

  @Prop() vehicleType?: string;

  @Prop({ type: Types.ObjectId, ref: 'Zone' }) zone?: Types.ObjectId;

  // Dispatch-quality signals: with no cost to declining an assignment, a
  // rider can cherry-pick only the closest/most profitable orders, degrading
  // dispatch efficiency exactly at peak hours. These counters are the raw
  // material for a soft acceptance-rate signal in dispatch ordering and in
  // admin rider management — incremented in orders.service.ts's assignOrder
  // (accepted) and rejectRiderAssignment (declined) paths.
  @Prop({ default: 0 }) acceptedAssignmentsCount?: number;
  @Prop({ default: 0 }) rejectedAssignmentsCount?: number;

  @Prop() accountNumber?: string;

  @Prop({ default: 0 }) currentWalletAmount?: number;
  @Prop({ default: 0 }) currentWalletAmountMinor?: number;

  @Prop({ default: 0 }) totalWalletAmount?: number;
  @Prop({ default: 0 }) totalWalletAmountMinor?: number;

  @Prop({ default: 0 }) withdrawnWalletAmount?: number;
  @Prop({ default: 0 }) withdrawnWalletAmountMinor?: number;

  @Prop() walletAmountCurrency?: string;

  @Prop() walletAmountScale?: number;

  @Prop({ default: true }) isOrderNotification?: boolean;

  @Prop({ default: true }) isOfferNotification?: boolean;

  @Prop({ type: GeoPoint }) lastKnownLocation?: GeoPoint;

  @Prop() lastSeenAt?: Date;

  @Prop({ type: BussinessDetails }) bussinessDetails?: BussinessDetails;

  @Prop({ type: LicenseDetails }) licenseDetails?: LicenseDetails;

  @Prop({ type: VehicleDetails }) vehicleDetails?: VehicleDetails;

  @Prop({ type: [DaySchedule], default: [] }) workSchedule?: DaySchedule[];
}

export const RiderSchema = SchemaFactory.createForClass(Rider);
RiderSchema.index({ lastKnownLocation: '2dsphere' });
// Matches the exact filter riders.service.ts uses to find dispatch
// candidates (`find({ zone: zoneId, isActive: true })`). Without this,
// every dispatch attempt does a full collection scan over all riders.
RiderSchema.index({ zone: 1, isActive: 1 });
