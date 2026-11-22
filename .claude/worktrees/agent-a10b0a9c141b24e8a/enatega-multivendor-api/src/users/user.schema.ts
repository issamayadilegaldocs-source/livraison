import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type UserDocument = HydratedDocument<User>;

// Proper single-nested subdocument (not an inline nested path) so the
// `coordinates` array is actually persisted. The previous inline form
// `{ type: { type: String, coordinates: [Number] } }` collided with Mongoose's
// reserved `type` keyword — Mongoose treated `location` as a plain `String` and
// silently dropped `coordinates`, surfacing later as a GeoPoint with null
// coordinates and breaking the non-nullable `GeoPoint.coordinates` GraphQL field.
@Schema({ _id: false })
export class GeoPoint {
  @Prop({ type: String, enum: ['Point'], default: 'Point' })
  type?: string;

  @Prop({ type: [Number] })
  coordinates?: number[];
}

export const GeoPointSchema = SchemaFactory.createForClass(GeoPoint);

@Schema({ _id: true })
export class Address {
  @Prop() label?: string;
  @Prop() deliveryAddress?: string;
  @Prop() details?: string;
  @Prop({ type: GeoPointSchema })
  location?: { type: string; coordinates: number[] };
  @Prop({ default: false }) selected?: boolean;
}

export const AddressSchema = SchemaFactory.createForClass(Address);

@Schema({ collection: 'users', timestamps: true })
export class User {
  @Prop() name?: string;

  @Prop({ lowercase: true, trim: true, sparse: true, index: true })
  email?: string;

  @Prop({ trim: true, sparse: true, index: true })
  phone?: string;

  @Prop({ select: false }) password?: string;

  @Prop({ type: String, index: true, sparse: true }) clerkId?: string;

  @Prop({ default: 'default' }) userType?: string;

  @Prop({ sparse: true, index: true }) appleId?: string;

  @Prop({ index: true, sparse: true }) notificationToken?: string;

  @Prop({ default: false }) emailIsVerified?: boolean;
  @Prop({ default: false }) phoneIsVerified?: boolean;

  @Prop({ default: true }) isActive?: boolean;
  @Prop({ default: true }) isOrderNotification?: boolean;
  @Prop({ default: true }) isOfferNotification?: boolean;

  @Prop({ type: [AddressSchema], default: [] }) addresses?: Address[];

  @Prop({ type: [String], default: [] }) favourite?: string[];

  @Prop({ default: 'active' }) status?: string;
  @Prop() lastLogin?: Date;
  @Prop() notes?: string;
  @Prop({ default: 'fr' }) preferredLanguage?: string;
}

export const UserSchema = SchemaFactory.createForClass(User);
// Enables $geoWithin lookups of customers by saved-address location (e.g. zone
// offer notifications). Sparse: many users have no address yet.
UserSchema.index({ 'addresses.location': '2dsphere' }, { sparse: true });
