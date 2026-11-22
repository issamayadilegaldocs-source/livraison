import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type OwnerDocument = HydratedDocument<Owner>;

/**
 * Admin/vendor account behind the `ownerLogin` mutation (admin dashboard).
 * Auth-relevant fields only for now; the vendor profile and the full
 * restaurant ownership graph land in later catalog steps. `userType`
 * distinguishes the platform admin (`ADMIN`) from a restaurant owner
 * (`VENDOR`).
 */
@Schema({ collection: 'owners', timestamps: true })
export class Owner {
  @Prop({ lowercase: true, trim: true, index: true })
  email!: string;

  /** bcrypt hash — deprecated, kept for migration window. */
  @Prop({ select: false }) password?: string;

  @Prop({ type: String, index: true, sparse: true }) clerkId?: string;

  @Prop({ default: 'VENDOR' }) userType?: string;

  @Prop({ type: [String], default: [] }) permissions?: string[];

  @Prop() userTypeId?: string;

  @Prop() image?: string;

  @Prop() name?: string;

  @Prop() firstName?: string;

  @Prop() lastName?: string;

  @Prop() phoneNumber?: string;

  /** Restaurants this owner manages; populated for the login response. */
  @Prop({ type: [{ type: Types.ObjectId, ref: 'Restaurant' }], default: [] })
  restaurants?: Types.ObjectId[];

  @Prop({ default: true }) isActive?: boolean;

  // ── Invitation tracking ────────────────────────────────────────────────────
  @Prop({ default: 'PENDING' }) invitationStatus?: string;
  @Prop() invitedAt?: Date;
  @Prop() acceptedAt?: Date;
  @Prop() clerkInvitationId?: string;
}

export const OwnerSchema = SchemaFactory.createForClass(Owner);
