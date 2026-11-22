import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type AuditLogDocument = HydratedDocument<AuditLog>;

@Schema({ _id: false })
class AuditAdminRef {
  @Prop() _id?: string;
  @Prop() email?: string;
}
const AuditAdminRefSchema = SchemaFactory.createForClass(AuditAdminRef);

@Schema({ collection: 'auditlogs', timestamps: true })
export class AuditLog {
  @Prop({ default: () => new Date() }) timestamp?: Date;
  @Prop({ type: AuditAdminRefSchema }) admin?: AuditAdminRef;
  @Prop() action?: string;
  @Prop() targetType?: string;
  @Prop() targetId?: string;
  @Prop() changes?: string;
}

export const AuditLogSchema = SchemaFactory.createForClass(AuditLog);
