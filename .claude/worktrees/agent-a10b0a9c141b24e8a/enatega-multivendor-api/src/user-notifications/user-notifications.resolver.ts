import { Args, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role, JwtUser } from '../auth/roles.enum';
import { CurrentUser } from '../auth/current-user.decorator';
import { UserNotificationModel } from './user-notification.model';
import { UserNotificationsService } from './user-notifications.service';

@UseGuards(ClerkAuthGuard, RolesGuard)
@Roles(Role.CUSTOMER, Role.STORE, Role.RIDER, Role.VENDOR)
@Resolver(() => UserNotificationModel)
export class UserNotificationsResolver {
  constructor(private readonly service: UserNotificationsService) {}

  @Query(() => [UserNotificationModel], { name: 'myNotifications' })
  myNotifications(
    @CurrentUser() jwt: JwtUser,
    @Args('limit', { type: () => Int, defaultValue: 30 }) limit: number,
  ) {
    return this.service.findForUser(jwt.userId, limit);
  }

  @Query(() => Int, { name: 'myUnreadNotificationsCount' })
  myUnreadNotificationsCount(@CurrentUser() jwt: JwtUser) {
    return this.service.countUnread(jwt.userId);
  }

  @Mutation(() => Int, { name: 'markNotificationsRead' })
  markNotificationsRead(
    @CurrentUser() jwt: JwtUser,
    @Args('ids', { type: () => [String] }) ids: string[],
  ) {
    return this.service.markRead(jwt.userId, ids);
  }

  @Mutation(() => Int, { name: 'markAllNotificationsRead' })
  markAllNotificationsRead(@CurrentUser() jwt: JwtUser) {
    return this.service.markAllRead(jwt.userId);
  }
}
