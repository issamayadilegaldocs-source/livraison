import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule } from '@nestjs/config';
import { SecurityModule } from '../auth/security.module';
import { UsersModule } from '../users/users.module';
import { RidersModule } from '../riders/riders.module';
import { RestaurantsModule } from '../restaurants/restaurants.module';
import { Notification, NotificationSchema } from './notification.schema';
import { WebNotification, WebNotificationSchema } from './web-notification.schema';
import { PushToken, PushTokenSchema } from './push-token.schema';
import { Otp, OtpSchema } from './otp.schema';
import { EmailOutbox, EmailOutboxSchema } from './email-outbox.schema';
import { NotificationsService } from './notifications.service';
import { NotificationsAdminResolver } from './notifications-admin.resolver';
import { NotificationsResolver } from './notifications.resolver';
import { EmailService } from './email.service';
import { OtpService } from './otp.service';
import { PushTokenService } from './push-token.service';
import { NotificationTokenHygieneService } from './notification-token-hygiene.service';
import { ScalewayEmailProvider } from '../providers/scaleway-email.provider';
import { ScalewaySmsProvider } from '../providers/scaleway-sms.provider';
import { FcmProvider } from '../providers/fcm.provider';
import { ExpoPushProvider } from '../providers/expo-push.provider';
import { UserNotificationsModule } from '../user-notifications/user-notifications.module';

@Module({
  imports: [
    ConfigModule,
    MongooseModule.forFeature([
      { name: Notification.name, schema: NotificationSchema },
      { name: WebNotification.name, schema: WebNotificationSchema },
      { name: PushToken.name, schema: PushTokenSchema },
      { name: Otp.name, schema: OtpSchema },
      { name: EmailOutbox.name, schema: EmailOutboxSchema },
    ]),
    forwardRef(() => SecurityModule),
    forwardRef(() => UsersModule),
    forwardRef(() => RidersModule),
    forwardRef(() => RestaurantsModule),
    UserNotificationsModule,
  ],
  providers: [
    NotificationsService,
    EmailService,
    OtpService,
    PushTokenService,
    NotificationTokenHygieneService,
    ScalewayEmailProvider,
    ScalewaySmsProvider,
    FcmProvider,
    ExpoPushProvider,
    NotificationsAdminResolver,
    NotificationsResolver,
  ],
  exports: [NotificationsService, EmailService, OtpService, PushTokenService, NotificationTokenHygieneService, ScalewayEmailProvider, ScalewaySmsProvider, FcmProvider, ExpoPushProvider],
})
export class NotificationsModule {}
