import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Notification, NotificationDocument } from './notification.schema';
import { WebNotification, WebNotificationDocument } from './web-notification.schema';
import { PushTokenService } from './push-token.service';
import { FcmProvider } from '../providers/fcm.provider';
import { ExpoPushProvider } from '../providers/expo-push.provider';
import { UserNotificationsService } from '../user-notifications/user-notifications.service';
import { PushDeliveryResult } from '../providers/push-delivery-result';
import { NotificationTokenHygieneService } from './notification-token-hygiene.service';

// Expo's managed push tokens look like `ExponentPushToken[xxxx]` or
// `ExpoPushToken[xxxx]` — anything else registered in this system today is
// a real FCM (Android web) or APNs token obtained directly from a
// provider SDK (only enatega-multivendor-admin's web push does this, via
// Firebase's JS SDK). Every mobile app (customer, rider — store never
// registers at all) calls Notifications.getExpoPushTokenAsync(), so their
// tokens are ALWAYS Expo-format, never raw FCM registration tokens.
const EXPO_TOKEN_PATTERN = /^Expo(nent)?PushToken\[.+\]$/;

function isExpoPushToken(token: string): boolean {
  return EXPO_TOKEN_PATTERN.test(token);
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectModel(Notification.name)
    private readonly notificationModel: Model<NotificationDocument>,
    @InjectModel(WebNotification.name)
    private readonly webNotificationModel: Model<WebNotificationDocument>,
    private readonly pushTokenService: PushTokenService,
    private readonly fcmProvider: FcmProvider,
    private readonly expoPushProvider: ExpoPushProvider,
    private readonly userNotificationsService: UserNotificationsService,
    private readonly tokenHygieneService: NotificationTokenHygieneService,
  ) {}

  findAll(): Promise<NotificationDocument[]> {
    return this.notificationModel.find().sort({ createdAt: -1 }).lean().exec() as Promise<NotificationDocument[]>;
  }

  findAllWeb(): Promise<WebNotificationDocument[]> {
    return this.webNotificationModel.find().sort({ createdAt: -1 }).lean().exec() as Promise<WebNotificationDocument[]>;
  }

  async sendNotificationUser(title: string | undefined, body: string): Promise<boolean> {
    await this.notificationModel.create({ title: title ?? '', body });
    return true;
  }

  async markWebNotificationsAsRead(): Promise<WebNotificationDocument[]> {
    await this.webNotificationModel.updateMany({}, { $set: { read: true } }).exec();
    return this.findAllWeb();
  }

  /**
   * Persist an admin-facing bell notification (e.g. new order placed).
   * Best-effort: a failure here must never block the caller's own flow.
   */
  async createWebNotification(body: string, navigateTo?: string): Promise<void> {
    try {
      await this.webNotificationModel.create({ body, navigateTo });
    } catch (error) {
      this.logger.warn(`Failed to persist web notification: ${error}`);
    }
  }

  /**
   * Send a push notification to a specific user (by userId + userType).
   * Saves to DB and delivers to all of the user's active device tokens,
   * routed to whichever provider actually issued each token.
   *
   * This unconditionally called fcmProvider before, but every mobile app
   * (customer, rider) registers Expo-managed tokens
   * (Notifications.getExpoPushTokenAsync) — FCM's Admin SDK rejects an
   * Expo-format token as an invalid registration token. Net effect: every
   * customer-facing push through this method (order accepted, scheduled-
   * order activated, delayed-order warning, the offer/promo broadcast) has
   * been silently failing 100% of the time in practice. Only
   * enatega-multivendor-admin's web push registers a real FCM token
   * (Firebase JS SDK, uploadToken mutation) — route per-token by its
   * actual format instead of assuming one provider for everyone.
   */
  async sendPushToUser(
    userId: string,
    userType: string,
    title: string,
    body: string,
    data?: Record<string, string>,
  ): Promise<boolean> {
    // Persist to notification center (CUSTOMER only — riders/vendors have no in-app center)
    if (userType === 'CUSTOMER') {
      const type = data?.type ?? 'SYSTEM';
      this.userNotificationsService.create(userId, title, body, type, data).catch(() => {});
    }

    const tokens = await this.pushTokenService.getUserTokens(userId, userType);
    if (tokens.length === 0) return false;

    const tokenStrings = tokens.map((t) => t.token);
    const expoTokens = tokenStrings.filter(isExpoPushToken);
    const fcmTokens = tokenStrings.filter((t) => !isExpoPushToken(t));

    const [expoResults, fcmResults] = await Promise.all([
      expoTokens.length > 0
        ? this.expoPushProvider.sendBatch(
            expoTokens.map((to) => ({
              to,
              title,
              body,
              priority: 'high' as const,
              channelId: 'default',
              data: data ?? {},
            })),
          )
        : Promise.resolve([]),
      fcmTokens.length > 0
        ? this.fcmProvider.sendToTokensDetailed(fcmTokens, { title, body, data })
        : Promise.resolve([]),
    ]);
    const results = [...expoResults, ...fcmResults];
    await Promise.all(results.map((result) => this.recordPushResult(result)));
    const sent = results.filter((r) => r.accepted).length;

    this.logger.debug(`Push sent to ${sent}/${tokenStrings.length} tokens for user ${userId}`);
    return sent > 0;
  }

  /**
   * Broadcast a push notification to multiple users (e.g. a zone-wide
   * offer to every customer in range). Previously delegated to
   * sendPushToUser per recipient — a broadcast to N users ran N separate
   * Mongo token lookups and N separate provider calls in one unbounded
   * Promise.all; a promo to a few thousand zone customers meant a few
   * thousand simultaneous DB queries plus a few thousand simultaneous
   * HTTP calls. Now does one bulk token lookup and hands every token to
   * the batched/chunked provider senders instead.
   */
  async broadcastPush(
    recipients: { userId: string; userType: string }[],
    title: string,
    body: string,
    data?: Record<string, string>,
  ): Promise<void> {
    if (recipients.length === 0) return;

    // Persist to each CUSTOMER recipient's in-app notification center —
    // still one insert per recipient (a local Mongo write, not an external
    // call), but that's the same cost the old per-recipient path already
    // paid; the fix here targets the external HTTP fan-out below.
    const type = data?.type ?? 'SYSTEM';
    await Promise.all(
      recipients
        .filter((r) => r.userType === 'CUSTOMER')
        .map((r) => this.userNotificationsService.create(r.userId, title, body, type, data).catch(() => {})),
    );

    const tokens = await this.pushTokenService.getTokensForUsers(recipients);
    if (tokens.length === 0) return;

    const tokenStrings = tokens.map((t) => t.token);
    const expoTokens = tokenStrings.filter(isExpoPushToken);
    const fcmTokens = tokenStrings.filter((t) => !isExpoPushToken(t));

    const [expoResults, fcmResults] = await Promise.all([
      expoTokens.length > 0
        ? this.expoPushProvider.sendBatch(
            expoTokens.map((to) => ({
              to,
              title,
              body,
              priority: 'high' as const,
              channelId: 'default',
              data: data ?? {},
            })),
          )
        : Promise.resolve([]),
      fcmTokens.length > 0
        ? this.fcmProvider.sendToTokensDetailed(fcmTokens, { title, body, data })
        : Promise.resolve([]),
    ]);
    const results = [...expoResults, ...fcmResults];
    await Promise.all(results.map((result) => this.recordPushResult(result)));

    const sent = results.filter((r) => r.accepted).length;
    this.logger.debug(`Broadcast push sent to ${sent}/${tokenStrings.length} tokens across ${recipients.length} recipient(s)`);
  }

  async sendNearbyOrderPushes(
    targets: { riderId: string; notificationToken: string }[],
    {
      orderId,
      restaurantName,
    }: {
      orderId: string;
      restaurantName: string;
    },
  ): Promise<number> {
    // Batched (Expo's documented 100-per-request limit) instead of one
    // concurrent HTTP request per rider — a zone with a few hundred online
    // riders previously meant a few hundred simultaneous axios calls to
    // Expo's push endpoint for a single order broadcast.
    const results = await this.expoPushProvider.sendBatch(
      targets.map((target) => ({
        to: target.notificationToken,
        title: '📦 Commande disponible',
        body: `${restaurantName} — commandez maintenant`,
        priority: 'high' as const,
        channelId: 'incoming_call',
        data: { type: 'NEARBY_ORDER', orderId },
      })),
    );
    await Promise.all(results.map((result) => this.recordPushResult(result)));
    return results.filter((result) => this.isPushAccepted(result)).length;
  }

  async sendIncomingOrderPushToRider({
    riderId,
    notificationToken,
    orderId,
    restaurantName,
    orderAmount,
  }: {
    riderId: string;
    notificationToken?: string;
    orderId: string;
    restaurantName: string;
    orderAmount?: number | string;
  }): Promise<boolean> {
    if (!notificationToken) {
      this.logger.warn(`[sendIncomingOrderPush] rider ${riderId} has no notificationToken`);
      return false;
    }
    const body = `${restaurantName}${orderAmount ? ` — ${orderAmount}` : ''}`;
    const result = await this.expoPushProvider.send({
      to: notificationToken,
      title: '📦 Nouvelle commande',
      body,
      priority: 'high',
      channelId: 'incoming_call',
      data: { type: 'INCOMING_ORDER', orderId },
    });
    await this.recordPushResult(result);
    return this.isPushAccepted(result);
  }

  private isPushAccepted(result: PushDeliveryResult | boolean): boolean {
    if (typeof result === 'boolean') {
      return result;
    }
    if (!result.accepted && result.permanentFailure) {
      this.logger.warn(
        `Permanent push token failure provider=${result.provider} token=${result.token} error=${result.errorCode ?? 'unknown'}`,
      );
    }
    return result.accepted;
  }

  private async recordPushResult(result: PushDeliveryResult | boolean): Promise<void> {
    if (typeof result === 'boolean') return;
    await this.tokenHygieneService.recordDeliveryResult(result);
  }
}
