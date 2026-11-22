import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { ObjectType, Field, ID } from '@nestjs/graphql';

export type EmailOutboxDocument = HydratedDocument<EmailOutbox>;

@ObjectType()
@Schema({ collection: 'email_outboxes', timestamps: true })
export class EmailOutbox {
  @Field(() => ID)
  _id: string;

  @Prop({ required: true })
  @Field()
  to: string;

  @Prop()
  @Field({ nullable: true })
  cc?: string;

  @Prop()
  @Field({ nullable: true })
  bcc?: string;

  @Prop({ required: true })
  @Field()
  subject: string;

  @Prop({ required: true })
  @Field()
  textBody: string;

  @Prop()
  @Field({ nullable: true })
  htmlBody?: string;

  @Prop({ type: Object, default: {} })
  templateData?: Record<string, any>;

  @Prop({ default: 'transactional', enum: ['transactional', 'marketing'] })
  @Field()
  emailType: string;

  @Prop({ default: 'pending', enum: ['pending', 'sent', 'failed', 'bounced'] })
  @Field()
  status: string;

  @Prop({ default: 0 })
  @Field()
  attempts: number;

  @Prop({ default: 3 })
  @Field()
  maxAttempts: number;

  @Prop()
  @Field({ nullable: true })
  providerMessageId?: string;

  @Prop()
  @Field({ nullable: true })
  providerStatus?: string;

  @Prop()
  @Field({ nullable: true })
  lastError?: string;

  @Prop()
  @Field({ nullable: true })
  lastAttemptAt?: Date;

  @Prop()
  @Field({ nullable: true })
  sentAt?: Date;

  @Prop({ required: true })
  @Field()
  idempotencyKey: string;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;
}

export const EmailOutboxSchema = SchemaFactory.createForClass(EmailOutbox);
EmailOutboxSchema.index({ status: 1, attempts: 1 });
EmailOutboxSchema.index({ to: 1 });
EmailOutboxSchema.index({ idempotencyKey: 1 }, { unique: true });
EmailOutboxSchema.index({ createdAt: 1 });
