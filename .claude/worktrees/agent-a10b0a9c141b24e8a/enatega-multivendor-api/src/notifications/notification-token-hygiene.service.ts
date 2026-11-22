import { Inject, Injectable, Logger, forwardRef } from '@nestjs/common';
import { PushDeliveryResult } from '../providers/push-delivery-result';
import { RestaurantsService } from '../restaurants/restaurants.service';
import { RidersService } from '../riders/riders.service';
import { UsersService } from '../users/users.service';
import { PushTokenService } from './push-token.service';

@Injectable()
export class NotificationTokenHygieneService {
  private readonly logger = new Logger(NotificationTokenHygieneService.name);

  constructor(
    private readonly pushTokenService: PushTokenService,
    @Inject(forwardRef(() => RidersService))
    private readonly ridersService: RidersService,
    @Inject(forwardRef(() => RestaurantsService))
    private readonly restaurantsService: RestaurantsService,
    @Inject(forwardRef(() => UsersService))
    private readonly usersService: UsersService,
  ) {}

  /**
   * A push token belongs to one physical device, not one account. If a
   * customer/rider/vendor logs out without the app calling
   * unregisterPushToken (none of the three mobile apps do today — see
   * NOTIFICATION_SYSTEM_AUDIT.md) and a different person logs in on the
   * same device, the previous account's token registration is never
   * deactivated. Without this, the next order-status push meant for the
   * FIRST account would still be delivered to this token — which is now
   * the SECOND account's device. Call this before writing any new
   * registration for a token so the previous owner's association (in the
   * multi-device PushToken collection AND the legacy single-field
   * notificationToken on User/Rider/Restaurant) is wiped first.
   *
   * `newOwnerUserId`, when given, is excluded from the PushToken
   * deactivation so a same-user re-login (same device, same account)
   * never has its own about-to-be-reactivated row touched.
   */
  async clearTokenEverywhere(token: string, newOwnerUserId?: string): Promise<void> {
    if (!token) return;
    const results = await Promise.allSettled([
      newOwnerUserId
        ? this.pushTokenService.deactivateOthers(token, newOwnerUserId)
        : this.pushTokenService.deactivateToken(token),
      this.ridersService.clearNotificationToken(token),
      this.restaurantsService.clearNotificationToken(token),
      this.usersService.clearNotificationToken(token),
    ]);
    const failed = results.filter((r) => r.status === 'rejected');
    if (failed.length) {
      this.logger.warn(
        `clearTokenEverywhere had ${failed.length} failure(s) for token reassignment: ${failed
          .map((r) => (r as PromiseRejectedResult).reason?.message ?? 'unknown')
          .join('; ')}`,
      );
    }
  }

  async recordDeliveryResult(result: PushDeliveryResult): Promise<void> {
    if (result.accepted || !result.permanentFailure) return;

    const [pushTokens, riders, restaurants, users] = await Promise.allSettled([
      this.pushTokenService.quarantinePermanentFailure({
        token: result.token,
        provider: result.provider,
        errorCode: result.errorCode,
      }),
      this.ridersService.clearNotificationToken(result.token),
      this.restaurantsService.clearNotificationToken(result.token),
      this.usersService.clearNotificationToken(result.token),
    ]);

    const failed = [pushTokens, riders, restaurants, users]
      .filter((entry) => entry.status === 'rejected')
      .map((entry) => (entry as PromiseRejectedResult).reason?.message ?? 'unknown');
    if (failed.length) {
      this.logger.warn(
        `Permanent push token cleanup had ${failed.length} failure(s) provider=${result.provider} token=${result.token}: ${failed.join('; ')}`,
      );
    }

    this.logger.warn(
      `Quarantined permanent push token failure provider=${result.provider} token=${result.token} error=${result.errorCode ?? 'unknown'} pushTokens=${this.valueOrZero(pushTokens)} riders=${this.valueOrZero(riders)} restaurants=${this.valueOrZero(restaurants)} users=${this.valueOrZero(users)}`,
    );
  }

  private valueOrZero(result: PromiseSettledResult<number>): number {
    return result.status === 'fulfilled' ? result.value : 0;
  }
}
