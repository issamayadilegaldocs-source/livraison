import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { randomInt } from 'crypto';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import { Otp, OtpDocument } from './otp.schema';
import { EmailService } from './email.service';
import { ScalewaySmsProvider } from '../providers/scaleway-sms.provider';

@Injectable()
export class OtpService {
  private readonly logger = new Logger(OtpService.name);

  constructor(
    @InjectModel(Otp.name)
    private readonly otpModel: Model<OtpDocument>,
    private readonly emailService: EmailService,
    private readonly smsProvider: ScalewaySmsProvider,
    private readonly configService: ConfigService,
  ) {}

  private generateCode(length: number = 6): string {
    return Array.from({ length }, () => randomInt(10)).join('');
  }

  async sendOtpToEmail(
    email: string,
    userId: string,
    userType: string,
    purpose: string = 'email_verify',
  ): Promise<OtpDocument> {
    const recentOtp = await this.otpModel.findOne({
      destination: email.toLowerCase().trim(),
      method: 'email',
      createdAt: { $gte: new Date(Date.now() - 60_000) },
    }).lean().exec();
    if (recentOtp) throw new BadRequestException('Please wait before requesting a new code');

    const codeLength = this.configService.get<number>('OTP_CODE_LENGTH') || 6;
    const expirationSeconds =
      this.configService.get<number>('OTP_EXPIRATION_SECONDS') || 600;

    const code = this.generateCode(codeLength);
    const expiresAt = new Date(Date.now() + expirationSeconds * 1000);

    const otp = await this.otpModel.create({
      code,
      method: 'email',
      destination: email.toLowerCase().trim(),
      userId,
      userType,
      purpose,
      verified: false,
      attempts: 0,
      expiresAt,
    });

    await this.emailService.queueEmail(
      email,
      'Your verification code',
      `Your verification code is: ${code}\n\nThis code expires in ${expirationSeconds / 60} minutes.`,
      `<p>Your verification code is: <strong>${code}</strong></p><p>This code expires in ${expirationSeconds / 60} minutes.</p>`,
    );
    this.emailService.sendPendingEmails().catch((err) =>
      this.logger.error(`Email flush failed: ${err?.message}`),
    );

    this.logger.debug(`OTP sent to email ${email}`);
    return otp;
  }

  async sendOtpToPhone(
    phoneNumber: string,
    userId: string,
    userType: string,
    purpose: string = 'phone_verify',
  ): Promise<OtpDocument> {
    if (!this.smsProvider.isEnabled()) {
      throw new BadRequestException('SMS service is not available');
    }

    const recentOtp = await this.otpModel.findOne({
      destination: phoneNumber.trim(),
      method: 'phone',
      createdAt: { $gte: new Date(Date.now() - 60_000) },
    }).lean().exec();
    if (recentOtp) throw new BadRequestException('Please wait before requesting a new code');

    const codeLength = this.configService.get<number>('OTP_CODE_LENGTH') || 6;
    const expirationSeconds =
      this.configService.get<number>('OTP_EXPIRATION_SECONDS') || 600;

    const code = this.generateCode(codeLength);
    const expiresAt = new Date(Date.now() + expirationSeconds * 1000);

    const otp = await this.otpModel.create({
      code,
      method: 'phone',
      destination: phoneNumber.trim(),
      userId,
      userType,
      purpose,
      verified: false,
      attempts: 0,
      expiresAt,
    });

    await this.smsProvider.sendSms({
      phoneNumber,
      message: `Your verification code is: ${code}. This code expires in ${expirationSeconds / 60} minutes.`,
    });

    this.logger.debug(`OTP sent to phone ${phoneNumber}`);
    return otp;
  }

  async verifyOtp(code: string, destination: string): Promise<OtpDocument> {
    const maxAttempts = this.configService.get<number>('OTP_MAX_ATTEMPTS') || 3;
    const now = new Date();

    const otp = await this.otpModel.findOne({
      destination,
      verified: false,
      expiresAt: { $gt: now },
    }).sort({ createdAt: -1 });

    if (!otp) {
      throw new BadRequestException('Invalid or expired OTP code');
    }

    if (otp.attempts >= maxAttempts) {
      throw new BadRequestException('Maximum OTP attempts exceeded');
    }

    if (otp.code !== code) {
      await this.otpModel.updateOne(
        { _id: otp._id },
        { $inc: { attempts: 1 } },
      );
      throw new BadRequestException('Invalid OTP code');
    }

    await this.otpModel.updateOne(
      { _id: otp._id },
      {
        $set: {
          verified: true,
          verifiedAt: now,
        },
      },
    );

    this.logger.debug(`OTP verified for ${destination}`);
    return otp;
  }

  /**
   * Check if an email has been verified via OTP for a specific purpose.
   */
  async isEmailVerified(email: string, purpose: string): Promise<boolean> {
    const verified = await this.otpModel.findOne({
      destination: email.toLowerCase().trim(),
      method: 'email',
      purpose,
      verified: true,
    });
    return !!verified;
  }

  /**
   * Check if a phone has been verified via OTP for a specific purpose.
   */
  async isPhoneVerified(phone: string, purpose: string): Promise<boolean> {
    const verified = await this.otpModel.findOne({
      destination: phone.trim(),
      method: 'phone',
      purpose,
      verified: true,
    });
    return !!verified;
  }

  /**
   * Get OTP records for a user.
   */
  async getOtpHistory(
    userId: string,
    limit: number = 10,
    offset: number = 0,
  ): Promise<OtpDocument[]> {
    return this.otpModel
      .find({ userId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(offset)
      .exec();
  }

  /**
   * Cleanup expired OTPs (run periodically).
   */
  async cleanupExpiredOtps(): Promise<number> {
    const result = await this.otpModel.deleteMany({
      expiresAt: { $lt: new Date() },
    });
    this.logger.debug(`Cleaned up ${result.deletedCount} expired OTPs`);
    return result.deletedCount;
  }
}
