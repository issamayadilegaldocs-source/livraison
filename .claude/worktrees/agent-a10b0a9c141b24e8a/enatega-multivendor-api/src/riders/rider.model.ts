import { Field, Float, ID, Int, ObjectType } from '@nestjs/graphql';

@ObjectType('RiderTimeSlot')
export class TimeSlotModel {
  @Field() startTime!: string;
  @Field() endTime!: string;
}

@ObjectType('WorkSchedule')
export class WorkScheduleModel {
  @Field() day!: string;
  @Field() enabled!: boolean;
  @Field(() => [TimeSlotModel]) slots!: TimeSlotModel[];
}

@ObjectType('RiderBussinessDetails')
export class RiderBussinessDetailsModel {
  @Field({ nullable: true }) bankName?: string;
  @Field({ nullable: true }) accountName?: string;
  @Field({ nullable: true }) accountCode?: string;
  @Field({ nullable: true }) accountNumber?: string;
  @Field({ nullable: true }) bussinessRegNo?: string;
  @Field({ nullable: true }) companyRegNo?: string;
  @Field({ nullable: true }) taxRate?: string;
}

@ObjectType('RiderLicenseDetails')
export class RiderLicenseDetailsModel {
  @Field({ nullable: true }) number?: string;
  @Field({ nullable: true }) expiryDate?: string;
  @Field({ nullable: true }) image?: string;
}

@ObjectType('RiderVehicleDetails')
export class RiderVehicleDetailsModel {
  @Field({ nullable: true }) number?: string;
  @Field({ nullable: true }) image?: string;
}

@ObjectType('RiderZoneRef')
export class RiderZoneRefModel {
  @Field(() => ID, { nullable: true }) _id?: string;
  @Field({ nullable: true }) title?: string;
}

@ObjectType('Rider')
export class RiderModel {
  @Field(() => ID) _id!: string;
  @Field({ nullable: true }) name?: string;
  @Field({ nullable: true }) username?: string;
  @Field({ nullable: true }) email?: string;
  @Field({ nullable: true }) phone?: string;
  @Field({ nullable: true }) image?: string;
  @Field({ nullable: true }) timeZone?: string;
  @Field({ nullable: true }) available?: boolean;
  @Field({ nullable: true }) isActive?: boolean;
  @Field({ nullable: true }) assigned?: boolean;
  @Field({ nullable: true }) vehicleType?: string;
  @Field(() => RiderZoneRefModel, { nullable: true }) zone?: RiderZoneRefModel;
  @Field(() => Int, { nullable: true }) acceptedAssignmentsCount?: number;
  @Field(() => Int, { nullable: true }) rejectedAssignmentsCount?: number;
  @Field({ nullable: true }) accountNumber?: string;
  @Field(() => Float, { nullable: true }) currentWalletAmount?: number;
  @Field(() => Float, { nullable: true }) totalWalletAmount?: number;
  @Field(() => Float, { nullable: true }) withdrawnWalletAmount?: number;
  @Field({ nullable: true }) isOrderNotification?: boolean;
  @Field({ nullable: true }) isOfferNotification?: boolean;
  @Field(() => RiderBussinessDetailsModel, { nullable: true })
  bussinessDetails?: RiderBussinessDetailsModel;
  @Field(() => RiderLicenseDetailsModel, { nullable: true })
  licenseDetails?: RiderLicenseDetailsModel;
  @Field(() => RiderVehicleDetailsModel, { nullable: true })
  vehicleDetails?: RiderVehicleDetailsModel;
  @Field(() => [WorkScheduleModel], { nullable: true }) workSchedule?: WorkScheduleModel[];
  @Field({ nullable: true }) password?: string;
  @Field({ nullable: true }) notificationToken?: string;
  @Field({ nullable: true }) createdAt?: string;
  @Field({ nullable: true }) updatedAt?: string;
}
