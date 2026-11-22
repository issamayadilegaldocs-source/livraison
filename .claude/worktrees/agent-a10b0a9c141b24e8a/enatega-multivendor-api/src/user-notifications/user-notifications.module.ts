import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UserNotification, UserNotificationSchema } from './user-notification.schema';
import { UserNotificationsService } from './user-notifications.service';
import { UserNotificationsResolver } from './user-notifications.resolver';
import { SecurityModule } from '../auth/security.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: UserNotification.name, schema: UserNotificationSchema },
    ]),
    SecurityModule,
  ],
  providers: [UserNotificationsService, UserNotificationsResolver],
  exports: [UserNotificationsService],
})
export class UserNotificationsModule {}
