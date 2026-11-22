import { Inject, UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { Role, JwtUser } from '../auth/roles.enum';
import { AppPubSub, PUB_SUB } from '../pubsub/pubsub.module';
import { Events } from '../subscriptions/events';
import { RidersService } from './riders.service';
import { DayScheduleInput, LicenseDetailsInput, VehicleDetailsInput } from './dto/rider.input';
import { BussinessDetailsInput } from '../restaurants/dto/restaurant.input';
import { RiderModel } from './rider.model';
import { RiderDocument } from './rider.schema';

@UseGuards(ClerkAuthGuard, RolesGuard)
@Roles(Role.RIDER)
@Resolver()
export class RidersResolver {
  constructor(
    private readonly ridersService: RidersService,
    @Inject(PUB_SUB) private readonly pubSub: AppPubSub,
  ) {}

  @Query(() => RiderModel, { name: 'riderProfile', nullable: true })
  riderProfile(@CurrentUser() jwt: JwtUser): Promise<RiderDocument | null> {
    return this.ridersService.findByClerkId(jwt.userId);
  }

  @Mutation(() => Boolean, { name: 'toggleRider' })
  async toggleRider(
    @CurrentUser() jwt: JwtUser,
    @Args('available', { type: () => Boolean }) available: boolean,
  ): Promise<boolean> {
    const rider = await this.ridersService.findByClerkId(jwt.userId);
    const mongoId = rider ? String((rider as any)._id) : jwt.userId;
    await this.ridersService.toggleAvailability(jwt.userId, available);
    await this.pubSub.publish(Events.RIDER_UPDATED, {
      [Events.RIDER_UPDATED]: { _id: mongoId },
    });
    return true;
  }

  @Mutation(() => RiderModel, { name: 'updateWorkSchedule' })
  async updateWorkSchedule(
    @CurrentUser() jwt: JwtUser,
    @Args('workSchedule', { type: () => [DayScheduleInput] }) workSchedule: DayScheduleInput[],
    @Args('timeZone', { type: () => String }) timeZone: string,
  ): Promise<RiderDocument> {
    const rider = await this.ridersService.findByClerkId(jwt.userId);
    if (!rider) throw new Error('Rider not found');
    return this.ridersService.updateWorkSchedule(String(rider._id), workSchedule, timeZone);
  }

  @Mutation(() => RiderModel, { name: 'updateRiderLicenseDetails' })
  async updateRiderLicenseDetails(
    @CurrentUser() jwt: JwtUser,
    @Args('id', { type: () => String }) id: string,
    @Args('licenseDetails', { type: () => LicenseDetailsInput, nullable: true })
    licenseDetails?: LicenseDetailsInput,
  ): Promise<RiderDocument> {
    return this.ridersService.updateLicenseDetails(id, (licenseDetails as any) ?? {});
  }

  @Mutation(() => RiderModel, { name: 'updateRiderVehicleDetails' })
  async updateRiderVehicleDetails(
    @CurrentUser() jwt: JwtUser,
    @Args('id', { type: () => String }) id: string,
    @Args('vehicleDetails', { type: () => VehicleDetailsInput, nullable: true })
    vehicleDetails?: VehicleDetailsInput,
  ): Promise<RiderDocument> {
    return this.ridersService.updateVehicleDetails(id, (vehicleDetails as any) ?? {});
  }

  @Mutation(() => RiderModel, { name: 'updateRiderBussinessDetails' })
  async updateRiderBussinessDetails(
    @CurrentUser() jwt: JwtUser,
    @Args('id', { type: () => String }) id: string,
    @Args('bussinessDetails', { type: () => BussinessDetailsInput, nullable: true })
    bussinessDetails?: BussinessDetailsInput,
  ): Promise<RiderDocument> {
    return this.ridersService.updateBussinessDetails(id, (bussinessDetails as any) ?? {});
  }
}
