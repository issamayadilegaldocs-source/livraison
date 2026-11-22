import { UseGuards } from '@nestjs/common';
import { Args, Float, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Throttle } from '@nestjs/throttler';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { Role, JwtUser } from '../auth/roles.enum';
import { RestaurantsService } from '../restaurants/restaurants.service';
import { RestaurantModel } from '../restaurants/restaurant.model';
import { AddressInput } from './dto/address.input';
import { UpdateUserInput } from './dto/update-user.input';
import { UserModel } from './models/user.model';
import { UsersService } from './users.service';
import { OtpService } from '../notifications/otp.service';
import { PushTokenService } from '../notifications/push-token.service';
import { OtpModel } from '../notifications/models/otp.model';
import { VerifyOtpInput } from '../notifications/dto/verify-otp.input';

@UseGuards(ClerkAuthGuard, RolesGuard)
@Roles(Role.CUSTOMER)
@Resolver(() => UserModel)
export class UsersResolver {
  constructor(
    private readonly usersService: UsersService,
    private readonly restaurantsService: RestaurantsService,
    private readonly otpService: OtpService,
    private readonly pushTokenService: PushTokenService,
  ) {}

  @Query(() => UserModel, { name: 'profile' })
  profile(@CurrentUser() jwtUser: JwtUser) {
    return this.usersService.getProfile(jwtUser.userId);
  }

  @Query(() => [RestaurantModel], { name: 'userFavourite' })
  async userFavourite(
    @CurrentUser() jwtUser: JwtUser,
    @Args('latitude', { type: () => Float, nullable: true }) _latitude?: number,
    @Args('longitude', { type: () => Float, nullable: true }) _longitude?: number,
  ) {
    const ids = await this.usersService.getFavouriteIds(jwtUser.userId);
    if (!ids.length) return [];
    const all = await Promise.all(
      ids.map((id) => this.restaurantsService.findById(id)),
    );
    return all.filter(Boolean);
  }

  @Mutation(() => UserModel, { name: 'updateUser' })
  updateUser(
    @CurrentUser() jwtUser: JwtUser,
    @Args('updateUserInput') input: UpdateUserInput,
  ) {
    return this.usersService.updateUser(jwtUser.userId, input);
  }

  @Mutation(() => UserModel, { name: 'createAddress' })
  createAddress(
    @CurrentUser() jwtUser: JwtUser,
    @Args('addressInput') input: AddressInput,
  ) {
    return this.usersService.createAddress(jwtUser.userId, input);
  }

  @Mutation(() => UserModel, { name: 'editAddress' })
  editAddress(
    @CurrentUser() jwtUser: JwtUser,
    @Args('addressInput') input: AddressInput,
  ) {
    return this.usersService.editAddress(jwtUser.userId, input);
  }

  @Mutation(() => UserModel, { name: 'deleteAddress' })
  deleteAddress(
    @CurrentUser() jwtUser: JwtUser,
    @Args('id', { type: () => ID }) id: string,
  ) {
    return this.usersService.deleteAddress(jwtUser.userId, id);
  }

  @Mutation(() => UserModel, { name: 'deleteBulkAddresses' })
  deleteBulkAddresses(
    @CurrentUser() jwtUser: JwtUser,
    @Args('ids', { type: () => [ID] }) ids: string[],
  ) {
    return this.usersService.deleteBulkAddresses(jwtUser.userId, ids);
  }

  @Mutation(() => UserModel, { name: 'selectAddress' })
  selectAddress(
    @CurrentUser() jwtUser: JwtUser,
    @Args('id', { type: () => String }) id: string,
  ) {
    return this.usersService.selectAddress(jwtUser.userId, id);
  }

  @Mutation(() => UserModel, { name: 'addFavourite' })
  addFavourite(
    @CurrentUser() jwtUser: JwtUser,
    @Args('id', { type: () => String }) id: string,
  ) {
    return this.usersService.toggleFavourite(jwtUser.userId, id);
  }

  // The per-destination 60s cooldown + 3-attempt cap in OtpService bound abuse
  // against a single email/phone, but the destination is caller-supplied and
  // not required to be the authenticated user's own — without a tighter
  // per-caller throttle here, one account could fan a paid SMS/email send out
  // to up to the global 100/min limit worth of arbitrary third-party targets.
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Mutation(() => OtpModel, { name: 'sendOtpToEmail' })
  async sendOtpToEmail(
    @CurrentUser() jwtUser: JwtUser,
    @Args('email', { type: () => String }) email: string,
  ) {
    return this.otpService.sendOtpToEmail(
      email,
      jwtUser.userId,
      Role.CUSTOMER,
      'email_verify',
    );
  }

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Mutation(() => OtpModel, { name: 'sendOtpToPhoneNumber' })
  async sendOtpToPhoneNumber(
    @CurrentUser() jwtUser: JwtUser,
    @Args('phone', { type: () => String }) phone: string,
  ) {
    return this.otpService.sendOtpToPhone(
      phone,
      jwtUser.userId,
      Role.CUSTOMER,
      'phone_verify',
    );
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Mutation(() => OtpModel, { name: 'verifyOtp' })
  async verifyOtp(
    @CurrentUser() jwtUser: JwtUser,
    @Args('otp', { type: () => String, nullable: true }) otp?: string,
    @Args('email', { type: () => String, nullable: true }) email?: string,
    @Args('phone', { type: () => String, nullable: true }) phone?: string,
    @Args('verifyOtpInput', { type: () => VerifyOtpInput, nullable: true }) verifyOtpInput?: VerifyOtpInput,
  ) {
    const code = verifyOtpInput?.code ?? otp ?? '';
    const destination = verifyOtpInput?.destination ?? email ?? phone ?? '';
    const record = await this.otpService.verifyOtp(code, destination.trim());
    return { ...record, result: record?.verified ?? false };
  }

  @Mutation(() => Boolean, { name: 'saveNotificationTokenWeb' })
  async saveNotificationTokenWeb(
    @CurrentUser() jwtUser: JwtUser,
    @Args('token', { type: () => String }) token: string,
  ) {
    await this.pushTokenService.registerToken(
      token,
      'web',
      jwtUser.userId,
      Role.CUSTOMER,
    );
    return true;
  }

  @Mutation(() => UserModel, { name: 'Deactivate' })
  Deactivate(
    @Args('isActive', { type: () => Boolean }) isActive: boolean,
    @Args('email', { type: () => String }) email: string,
  ) {
    return this.usersService.deactivateByEmail(email, isActive);
  }

  @Mutation(() => UserModel, { name: 'phoneExist', nullable: true })
  async phoneExist(
    @Args('phone', { type: () => String }) phone: string,
  ) {
    return this.usersService.findByPhone(phone);
  }
}
