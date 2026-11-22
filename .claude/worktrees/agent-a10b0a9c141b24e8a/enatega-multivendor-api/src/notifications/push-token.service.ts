import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PushToken, PushTokenDocument } from './push-token.schema';

@Injectable()
export class PushTokenService {
  private readonly logger = new Logger(PushTokenService.name);

  constructor(
    @InjectModel(PushToken.name)
    private readonly pushTokenModel: Model<PushTokenDocument>,
  ) {}

  /**
   * Register or update a push notification token for a user.
   */
  async registerToken(
    token: string,
    platform: string,
    userId: string,
    userType: string,
  ): Promise<PushTokenDocument> {
    const existing = await this.pushTokenModel.findOne({
      token,
      userId,
      userType,
      platform,
    });

    if (existing) {
      existing.active = true;
      existing.lastUsedAt = new Date();
      return existing.save();
    }

    const pushToken = await this.pushTokenModel.create({
      token,
      platform,
      userId,
      userType,
      active: true,
      lastUsedAt: new Date(),
    });

    this.logger.debug(
      `Push token registered for user ${userId} on ${platform}`,
    );
    return pushToken;
  }

  /**
   * Deactivate a push token, regardless of owner. Used internally when a
   * token is being reassigned to a new account (clearTokenEverywhere) or
   * quarantined for a permanent provider failure — both cases are allowed
   * to touch another user's record because the token itself, not the
   * caller, is the authority. Never expose this directly to a resolver
   * without an ownership check — see deactivateOwnToken.
   */
  async deactivateToken(token: string): Promise<boolean> {
    const result = await this.pushTokenModel.updateMany(
      { token },
      { $set: { active: false, deactivatedAt: new Date() } },
    );
    return result.modifiedCount > 0;
  }

  /**
   * Deactivate a token on behalf of an authenticated caller — scoped so a
   * user can only ever deactivate their own token, not anyone else's by
   * guessing/leaking the token string.
   */
  async deactivateOwnToken(token: string, userId: string): Promise<boolean> {
    const result = await this.pushTokenModel.updateMany(
      { token, userId },
      { $set: { active: false, deactivatedAt: new Date() } },
    );
    return result.modifiedCount > 0;
  }

  /**
   * Deactivate every OTHER account's registration of this token, excluding
   * the new/current owner. Used when reassigning a physical token to a new
   * user (see clearTokenEverywhere) — narrower than deactivateToken so a
   * same-user re-login (same device, same account) never has its own
   * about-to-be-reactivated row touched, even for the instant between the
   * clear and the fresh registerToken call that follows it.
   */
  async deactivateOthers(token: string, exceptUserId: string): Promise<number> {
    const result = await this.pushTokenModel.updateMany(
      { token, userId: { $ne: exceptUserId } },
      { $set: { active: false, deactivatedAt: new Date() } },
    );
    return result.modifiedCount;
  }

  async quarantinePermanentFailure({
    token,
    provider,
    errorCode,
  }: {
    token: string;
    provider: string;
    errorCode?: string;
  }): Promise<number> {
    const reason = ['permanent_push_failure', provider, errorCode].filter(Boolean).join(':');
    const result = await this.pushTokenModel.updateMany(
      { token, active: { $ne: false } },
      {
        $set: {
          active: false,
          deactivatedAt: new Date(),
          deactivationReason: reason,
        },
      },
    );
    return result.modifiedCount;
  }

  /**
   * Get active push tokens for a user.
   */
  async getUserTokens(
    userId: string,
    userType: string,
  ): Promise<PushTokenDocument[]> {
    return this.pushTokenModel
      .find({ userId, userType, active: true })
      .exec();
  }

  /**
   * Bulk token lookup for a broadcast — one query instead of one
   * getUserTokens call per recipient. Used by NotificationsService's
   * broadcastPush, which previously ran N Mongo queries (and N provider
   * calls) for N recipients; a zone offer to a few thousand customers was
   * a few thousand parallel queries + sends in one Promise.all.
   */
  async getTokensForUsers(
    recipients: { userId: string; userType: string }[],
  ): Promise<PushTokenDocument[]> {
    if (recipients.length === 0) return [];
    return this.pushTokenModel
      .find({ active: true, $or: recipients.map((r) => ({ userId: r.userId, userType: r.userType })) })
      .exec();
  }

  /**
   * Get tokens for a specific platform and user.
   */
  async getUserTokensByPlatform(
    userId: string,
    userType: string,
    platform: string,
  ): Promise<PushTokenDocument[]> {
    return this.pushTokenModel
      .find({ userId, userType, platform, active: true })
      .exec();
  }

  /**
   * Remove a specific push token.
   */
  async removeToken(token: string): Promise<boolean> {
    const result = await this.pushTokenModel.deleteOne({ token });
    return result.deletedCount > 0;
  }

  /**
   * Cleanup inactive tokens. Was previously dead code — the method existed
   * with a "run periodically" comment but had zero callers anywhere in the
   * codebase, no @Cron, no scheduler wiring — so deactivated tokens
   * (including ones this same class quarantines for permanent provider
   * failures) accumulated in the collection forever. Runs daily.
   */
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async cleanupInactiveTokens(daysOld: number = 90): Promise<number> {
    const cutoffDate = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);
    const result = await this.pushTokenModel.deleteMany({
      active: false,
      updatedAt: { $lt: cutoffDate },
    });
    this.logger.debug(`Cleaned up ${result.deletedCount} inactive push tokens`);
    return result.deletedCount;
  }

  /**
   * Get token count for a user.
   */
  async getUserTokenCount(userId: string, userType: string): Promise<number> {
    return this.pushTokenModel.countDocuments({ userId, userType, active: true });
  }
}
