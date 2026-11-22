import { UseGuards } from '@nestjs/common';
import { Args, Mutation, Resolver } from '@nestjs/graphql';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { Role, JwtUser } from '../auth/roles.enum';
import { UsersService } from '../users/users.service';
import { RidersService } from '../riders/riders.service';
import { RestaurantsService } from '../restaurants/restaurants.service';
import { NotificationStatusModel } from './models/notification-status.model';
import { PushTokenRegistrationModel } from './models/push-token-registration.model';
import { PushTokenService } from './push-token.service';
import { NotificationTokenHygieneService } from './notification-token-hygiene.service';

@UseGuards(ClerkAuthGuard, RolesGuard)
@Roles(Role.CUSTOMER, Role.RIDER, Role.STORE)
@Resolver()
export class NotificationsResolver {
  constructor(
    private readonly usersService: UsersService,
    private readonly ridersService: RidersService,
    private readonly restaurantsService: RestaurantsService,
    private readonly pushTokenService: PushTokenService,
    private readonly tokenHygieneService: NotificationTokenHygieneService,
  ) {}

  @Mutation(() => NotificationStatusModel, { name: 'updateNotificationStatus' })
  async updateNotificationStatus(
    @CurrentUser() jwtUser: JwtUser,
    @Args('orderNotification', { type: () => Boolean }) orderNotification: boolean,
    @Args('offerNotification', { type: () => Boolean }) offerNotification: boolean,
  ): Promise<NotificationStatusModel> {
    const { userId, role } = jwtUser;

    if (role === Role.RIDER) {
      const rider = await this.ridersService.updateNotificationPrefs(userId, orderNotification, offerNotification);
      return {
        _id: String(rider._id),
        notificationToken: rider.notificationToken,
        isOrderNotification: rider.isOrderNotification,
        isOfferNotification: rider.isOfferNotification,
      };
    }

    if (role === Role.STORE) {
      const restaurant = await this.restaurantsService.updateNotificationPrefs(userId, orderNotification, offerNotification);
      return {
        _id: String((restaurant as any)._id),
        notificationToken: restaurant.notificationToken,
        isOrderNotification: (restaurant as any).isOrderNotification,
        isOfferNotification: (restaurant as any).isOfferNotification,
      };
    }

    // CUSTOMER
    const user = await this.usersService.updateNotificationPrefs(userId, orderNotification, offerNotification);
    return {
      _id: String(user._id),
      notificationToken: user.notificationToken,
      isOrderNotification: user.isOrderNotification,
      isOfferNotification: user.isOfferNotification,
    };
  }

  @Mutation(() => Boolean, { name: 'registerPushToken' })
  async registerPushToken(
    @CurrentUser() jwtUser: JwtUser,
    @Args('token', { type: () => String }) token: string,
    @Args('platform', { type: () => String }) platform: string,
  ): Promise<boolean> {
    const userTypeMap: Record<Role, string> = {
      [Role.CUSTOMER]: 'CUSTOMER',
      [Role.RIDER]: 'RIDER',
      [Role.STORE]: 'STORE',
      [Role.ADMIN]: 'ADMIN',
      [Role.VENDOR]: 'VENDOR',
    };
    // A physical token belongs to one device. If a different account
    // registered it previously (device reused/shared, or the previous
    // session never called unregisterPushToken — none of the three mobile
    // apps do today), that stale association must be wiped first or the
    // previous user keeps receiving pushes meant for whoever is logged in
    // now. See NOTIFICATION_SYSTEM_AUDIT.md.
    await this.tokenHygieneService.clearTokenEverywhere(token, jwtUser.userId);
    await this.pushTokenService.registerToken(token, platform, jwtUser.userId, userTypeMap[jwtUser.role]);
    return true;
  }

  @Mutation(() => Boolean, { name: 'unregisterPushToken' })
  async unregisterPushToken(
    @CurrentUser() jwtUser: JwtUser,
    @Args('token', { type: () => String }) token: string,
  ): Promise<boolean> {
    // Previously scoped by token alone with no ownership check — any
    // authenticated caller could deactivate any other user's token by
    // guessing/leaking the string. Scope to the caller's own token.
    return this.pushTokenService.deactivateOwnToken(token, jwtUser.userId);
  }

  @Mutation(() => PushTokenRegistrationModel, { name: 'pushToken' })
  async pushToken(
    @CurrentUser() jwtUser: JwtUser,
    @Args('token', { type: () => String, nullable: true }) token?: string,
  ): Promise<PushTokenRegistrationModel> {
    const { userId, role } = jwtUser;

    if (role === Role.RIDER) {
      const rider = await this.ridersService.findByClerkId(userId);
      if (token && rider) {
        await this.tokenHygieneService.clearTokenEverywhere(token, userId);
        await this.ridersService.onLogin(rider, { notificationToken: token });
        await this.pushTokenService.registerToken(token, 'mobile', userId, Role.RIDER);
      }
      return { _id: rider ? String(rider._id) : userId, notificationToken: token };
    }

    if (role === Role.STORE || role === Role.VENDOR) {
      const rest = await this.restaurantsService.findByClerkId(userId);
      if (token && rest) {
        await this.tokenHygieneService.clearTokenEverywhere(token, userId);
        await this.restaurantsService.saveNotificationToken(userId, token, undefined);
        await this.pushTokenService.registerToken(token, 'mobile', userId, role);
      }
      return { _id: rest ? String(rest._id) : userId, notificationToken: token };
    }

    // CUSTOMER (default)
    const user = await this.usersService.getProfile(userId);
    if (token) {
      await this.tokenHygieneService.clearTokenEverywhere(token, userId);
      await this.usersService.setNotificationToken(user, token);
      await this.pushTokenService.registerToken(token, 'mobile', userId, Role.CUSTOMER);
    }
    return { _id: String(user._id), notificationToken: token };
  }
}
