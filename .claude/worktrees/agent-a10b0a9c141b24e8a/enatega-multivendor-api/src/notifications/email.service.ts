import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import { EmailOutbox, EmailOutboxDocument } from './email-outbox.schema';
import { ScalewayEmailProvider } from '../providers/scaleway-email.provider';
import * as crypto from 'crypto';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(
    @InjectModel(EmailOutbox.name)
    private readonly emailOutboxModel: Model<EmailOutboxDocument>,
    private readonly scalewayEmailProvider: ScalewayEmailProvider,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Queue an email for sending with idempotency key for deduplication.
   * Returns the database record if queued, null if skipped due to duplicate idempotency key.
   */
  async queueEmail(
    to: string,
    subject: string,
    textBody: string,
    htmlBody?: string,
    cc?: string,
    bcc?: string,
  ): Promise<EmailOutboxDocument | null> {
    const idempotencyKey = crypto.randomBytes(16).toString('hex');
    return this.queueEmailWithIdempotency(
      to,
      subject,
      textBody,
      htmlBody,
      cc,
      bcc,
      idempotencyKey,
    );
  }

  /**
   * Queue an email with explicit idempotency key for exactly-once semantics.
   */
  async queueEmailWithIdempotency(
    to: string,
    subject: string,
    textBody: string,
    htmlBody?: string,
    cc?: string,
    bcc?: string,
    idempotencyKey?: string,
  ): Promise<EmailOutboxDocument | null> {
    const key = idempotencyKey || crypto.randomBytes(16).toString('hex');

    try {
      const record = await this.emailOutboxModel.create({
        to,
        subject,
        textBody,
        htmlBody,
        cc,
        bcc,
        status: 'pending',
        idempotencyKey: key,
        emailType: 'transactional',
        attempts: 0,
        maxAttempts: 3,
      });

      this.logger.debug(`Email queued to ${to} with idempotency key ${key}`);
      return record;
    } catch (error) {
      const err = error as any;
      if (err.code === 11000 && err.keyPattern?.idempotencyKey) {
        this.logger.debug(`Email with idempotency key ${key} already queued`);
        return null;
      }
      throw error;
    }
  }

  /**
   * Send all pending emails (used by a background worker).
   */
  async sendPendingEmails(): Promise<number> {
    const maxAttempts = this.configService.get<number>('EMAIL_MAX_ATTEMPTS') || 3;
    const pending = await this.emailOutboxModel
      .find({
        status: 'pending',
        attempts: { $lt: maxAttempts },
      })
      .limit(100)
      .exec();

    let sentCount = 0;
    for (const record of pending) {
      const success = await this.sendEmailRecord(record);
      if (success) sentCount++;
    }

    return sentCount;
  }

  /**
   * Send a single email record.
   */
  private async sendEmailRecord(record: EmailOutboxDocument): Promise<boolean> {
    try {
      const sendingDomain = this.scalewayEmailProvider.getSendingDomain();
      const fromName = this.scalewayEmailProvider.getFromName();

      const response = await this.scalewayEmailProvider.sendEmail({
        from: {
          email: sendingDomain,
          name: fromName,
        },
        to: [{ email: record.to }],
        cc: record.cc ? [{ email: record.cc }] : undefined,
        bcc: record.bcc ? [{ email: record.bcc }] : undefined,
        subject: record.subject,
        text: record.textBody,
        html: record.htmlBody,
      });

      if (response) {
        const messageId = response.messages?.[0]?.id;
        await this.emailOutboxModel.updateOne(
          { _id: record._id },
          {
            $set: {
              status: 'sent',
              sentAt: new Date(),
              providerMessageId: messageId,
              providerStatus: response.messages?.[0]?.status,
              lastAttemptAt: new Date(),
            },
            $inc: { attempts: 1 },
          },
        );
        this.logger.debug(`Email sent to ${record.to}`);
        return true;
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(`Failed to send email to ${record.to}: ${err.message}`);
      await this.emailOutboxModel.updateOne(
        { _id: record._id },
        {
          $set: {
            lastError: err.message,
            lastAttemptAt: new Date(),
          },
          $inc: { attempts: 1 },
        },
      );

      if (record.attempts + 1 >= record.maxAttempts) {
        await this.emailOutboxModel.updateOne(
          { _id: record._id },
          { $set: { status: 'failed' } },
        );
      }
    }

    return false;
  }

  /**
   * Get email history for a recipient.
   */
  async getEmailHistory(
    to: string,
    limit: number = 20,
    offset: number = 0,
  ): Promise<EmailOutboxDocument[]> {
    return this.emailOutboxModel
      .find({ to })
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(offset)
      .exec();
  }

  /**
   * Get email status by idempotency key.
   */
  async getEmailStatus(idempotencyKey: string): Promise<EmailOutboxDocument | null> {
    return this.emailOutboxModel.findOne({ idempotencyKey }).exec();
  }
}
