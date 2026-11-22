import { Field, Float, ID, Int, ObjectType } from '@nestjs/graphql';
import { DeliveryTimeEstimationMode } from '../delivery-estimation/dto/delivery-time-estimation-mode.enum';

@ObjectType('MetricsGeneral')
export class MetricsGeneralModel {
  @Field({ nullable: true }) excellence?: string;
  @Field({ nullable: true }) topgun?: string;
  @Field({ nullable: true }) experience?: string;
  @Field({ nullable: true }) skydiver?: string;
  @Field({ nullable: true }) rider?: string;
  @Field({ nullable: true }) haha?: string;
  @Field({ nullable: true }) hehe?: string;
  @Field({ nullable: true }) huhu?: string;
  @Field({ nullable: true }) yoyo?: string;
  @Field({ nullable: true }) turu?: string;
}

@ObjectType('AppType')
export class AppTypeModel {
  @Field({ nullable: true }) android?: string;
  @Field({ nullable: true }) ios?: string;
}

@ObjectType('Versions')
export class VersionsModel {
  @Field(() => AppTypeModel, { nullable: true }) customerAppVersion?: AppTypeModel;
  @Field(() => AppTypeModel, { nullable: true }) riderAppVersion?: AppTypeModel;
  @Field(() => AppTypeModel, { nullable: true }) restaurantAppVersion?: AppTypeModel;
}

/**
 * GraphQL representation of {@link Configuration}. Field names and nullability
 * mirror the client `configuration` queries (admin, customer, store, rider) so
 * a single role-aware type stays compatible with every app.
 */
@ObjectType('Configuration')
export class ConfigurationModel {
  @Field(() => ID)
  _id!: string;

  @Field({ nullable: true }) currency?: string;
  @Field({ nullable: true }) currencySymbol?: string;
  @Field(() => Int, { nullable: true }) currencyDecimalDigits?: number;
  @Field(() => Float, { nullable: true }) deliveryRate?: number;
  @Field({ nullable: true }) costType?: string;
  @Field(() => Float, { nullable: true }) baseDeliveryFee?: number;
  @Field(() => Float, { nullable: true }) baseDeliveryDistance?: number;
  @Field(() => Float, { nullable: true }) deliveryFeeMinimum?: number;
  @Field(() => Float, { nullable: true }) deliveryFeeMaximum?: number;
  @Field(() => Float, { nullable: true }) deliveryRoundToNearest?: number;
  @Field(() => DeliveryTimeEstimationMode, { nullable: true })
  deliveryTimeEstimationMode?: DeliveryTimeEstimationMode;

  @Field({ nullable: true }) skipWhatsAppOTP?: boolean;

  @Field({ nullable: true }) termsAndConditions?: string;
  @Field({ nullable: true }) privacyPolicy?: string;
  @Field({ nullable: true }) testOtp?: string;
  @Field({ nullable: true }) isPaidVersion?: boolean;
  @Field({ nullable: true }) skipEmailVerification?: boolean;
  @Field({ nullable: true }) skipMobileVerification?: boolean;

  @Field({ nullable: true }) enableRiderDemo?: boolean;
  @Field({ nullable: true }) enableRestaurantDemo?: boolean;
  @Field({ nullable: true }) enableAdminDemo?: boolean;

  @Field(() => Float, { nullable: true }) maxTipPercentage?: number;

  @Field({ nullable: true }) serviceFeeEnabled?: boolean;
  @Field(() => Float, { nullable: true }) serviceFeeRate?: number;
  @Field(() => Float, { nullable: true }) serviceFeeMinimum?: number;
  @Field(() => Float, { nullable: true }) serviceFeeMaximum?: number;

  @Field(() => Float, { nullable: true }) riderCommissionRate?: number;
  @Field(() => Float, { nullable: true }) deliveryAutoConfirmHours?: number;

  @Field({ nullable: true }) deliveryBonusEnabled?: boolean;
  @Field(() => Float, { nullable: true }) deliveryBonusPerKm?: number;
  @Field(() => Float, { nullable: true }) deliveryBonusFreeDistance?: number;
  @Field(() => Float, { nullable: true }) deliveryBonusMax?: number;

  @Field({ nullable: true }) requireArrivedStep?: boolean;
  @Field({ nullable: true }) enforceArrivalGps?: boolean;
  @Field(() => Float, { nullable: true }) arrivalGpsRadiusMeters?: number;

  @Field({ nullable: true }) loyaltyEnabled?: boolean;
  @Field(() => Float, { nullable: true }) loyaltyPointsPerUnit?: number;
  @Field(() => Float, { nullable: true }) loyaltyPointsRedemptionRate?: number;

  @Field({ nullable: true }) expressEnabled?: boolean;
  @Field(() => Float, { nullable: true }) expressSurcharge?: number;

  @Field(() => AppTypeModel, { nullable: true }) customerAppVersion?: AppTypeModel;
  @Field(() => AppTypeModel, { nullable: true }) riderAppVersion?: AppTypeModel;
  @Field(() => AppTypeModel, { nullable: true }) restaurantAppVersion?: AppTypeModel;
}
