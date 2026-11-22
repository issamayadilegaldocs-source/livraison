import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type StaffDocument = HydratedDocument<Staff>;

@Schema({ collection: 'staffs', timestamps: true })
export class Staff {
  @Prop() name?: string;
  @Prop({ lowercase: true, trim: true, index: true }) email?: string;
  @Prop({ select: false }) password?: string;

  @Prop({ type: String, index: true, sparse: true }) clerkId?: string;
  @Prop() phone?: string;
  @Prop({ default: true }) isActive?: boolean;
  @Prop({ type: [String], default: [] }) permissions?: string[];
  @Prop({ default: 'STAFF' }) userType?: string;
}

export const StaffSchema = SchemaFactory.createForClass(Staff);
