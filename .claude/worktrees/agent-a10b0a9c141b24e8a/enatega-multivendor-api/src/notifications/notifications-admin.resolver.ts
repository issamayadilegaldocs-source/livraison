import { UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '../auth/roles.enum';
import { NotificationModel } from './notification.model';
import { WebNotificationModel } from './web-notification.model';
import { NotificationsService } from './notifications.service';

@UseGuards(ClerkAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Resolver()
export class NotificationsAdminResolver {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Query(() => [NotificationModel], { name: 'getNotifications' })
  getNotifications() {
    return this.notificationsService.findAll();
  }

  @Query(() => [NotificationModel], { name: 'notifications' })
  notifications() {
    return this.notificationsService.findAll();
  }

  @Query(() => [WebNotificationModel], { name: 'getWebNotifications' })
  getWebNotifications() {
    return this.notificationsService.findAllWeb();
  }

  @Mutation(() => Boolean, { name: 'sendNotificationUser' })
  sendNotificationUser(
    @Args('notificationTitle', { type: () => String, nullable: true }) notificationTitle?: string,
    @Args('notificationBody', { type: () => String }) notificationBody: string = '',
  ) {
    return this.notificationsService.sendNotificationUser(notificationTitle, notificationBody);
  }

  @Mutation(() => [WebNotificationModel], { name: 'markWebNotificationsAsRead' })
  markWebNotificationsAsRead() {
    return this.notificationsService.markWebNotificationsAsRead();
  }
}
