import { Field, Float, InputType, Int } from '@nestjs/graphql';
import { IsBoolean, IsEnum, IsNumber, IsOptional, IsString } from 'class-validator';
import { DeliveryTimeEstimationMode } from '../../delivery-estimation/dto/delivery-time-estimation-mode.enum';

/**
 * Input types for the configuration `save*` mutations. Each input and its
 * fields mirror the matching admin client mutation (see
 * `enatega-multivendor-admin/lib/api/graphql/mutations/configuration`) so the
 * single role-aware schema stays compatible with the dashboard forms. Every
 * field is nullable: a form submits only the section it owns and untouched
 * fields must not be overwritten.
 */

@InputType()
export class AppConfigurationsInput {
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  termsAndConditions?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  privacyPolicy?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  testOtp?: string;
}

@InputType()
export class DeliveryCostConfigurationInput {
  @Field(() => Float, { nullable: true })
  @IsOptional()
  @IsNumber()
  deliveryRate?: number;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  costType?: string;

  @Field(() => Float, { nullable: true })
  @IsOptional()
  @IsNumber()
  baseDeliveryFee?: number;

  @Field(() => Float, { nullable: true })
  @IsOptional()
  @IsNumber()
  baseDeliveryDistance?: number;

  @Field(() => Float, { nullable: true })
  @IsOptional()
  @IsNumber()
  deliveryFeeMinimum?: number;

  @Field(() => Float, { nullable: true })
  @IsOptional()
  @IsNumber()
  deliveryFeeMaximum?: number;

  @Field(() => Float, { nullable: true })
  @IsOptional()
  @IsNumber()
  deliveryRoundToNearest?: number;

  @Field(() => DeliveryTimeEstimationMode, { nullable: true })
  @IsOptional()
  @IsEnum(DeliveryTimeEstimationMode)
  deliveryTimeEstimationMode?: DeliveryTimeEstimationMode;
}

@InputType()
export class VerificationConfigurationInput {
  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  skipEmailVerification?: boolean;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  skipMobileVerification?: boolean;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  skipWhatsAppOTP?: boolean;
}

@InputType()
export class CurrencyConfigurationInput {
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  currency?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  currencySymbol?: string;

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsNumber()
  currencyDecimalDigits?: number;
}

@InputType()
export class FinanceConfigurationInput {
  @Field(() => Float, { nullable: true })
  @IsOptional()
  @IsNumber()
  maxTipPercentage?: number;
}

@InputType()
export class ServiceFeeConfigurationInput {
  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  serviceFeeEnabled?: boolean;

  // Fraction (0.07 = 7%). The admin form enters a percentage and divides by 100.
  @Field(() => Float, { nullable: true })
  @IsOptional()
  @IsNumber()
  serviceFeeRate?: number;

  @Field(() => Float, { nullable: true })
  @IsOptional()
  @IsNumber()
  serviceFeeMinimum?: number;

  @Field(() => Float, { nullable: true })
  @IsOptional()
  @IsNumber()
  serviceFeeMaximum?: number;
}

@InputType()
export class RiderCommissionConfigurationInput {
  @Field(() => Float, { nullable: true })
  @IsOptional()
  @IsNumber()
  riderCommissionRate?: number;

  @Field(() => Float, { nullable: true })
  @IsOptional()
  @IsNumber()
  deliveryAutoConfirmHours?: number;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  requireArrivedStep?: boolean;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  enforceArrivalGps?: boolean;

  @Field(() => Float, { nullable: true })
  @IsOptional()
  @IsNumber()
  arrivalGpsRadiusMeters?: number;
}

@InputType()
export class RiderBonusConfigurationInput {
  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  deliveryBonusEnabled?: boolean;

  @Field(() => Float, { nullable: true })
  @IsOptional()
  @IsNumber()
  deliveryBonusPerKm?: number;

  @Field(() => Float, { nullable: true })
  @IsOptional()
  @IsNumber()
  deliveryBonusFreeDistance?: number;

  @Field(() => Float, { nullable: true })
  @IsOptional()
  @IsNumber()
  deliveryBonusMax?: number;
}

@InputType()
export class LoyaltyConfigurationInput {
  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  loyaltyEnabled?: boolean;

  @Field(() => Float, { nullable: true })
  @IsOptional()
  @IsNumber()
  loyaltyPointsPerUnit?: number;

  @Field(() => Float, { nullable: true })
  @IsOptional()
  @IsNumber()
  loyaltyPointsRedemptionRate?: number;
}

@InputType()
export class ExpressConfigurationInput {
  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  expressEnabled?: boolean;

  @Field(() => Float, { nullable: true })
  @IsOptional()
  @IsNumber()
  expressSurcharge?: number;
}

@InputType('AppTypeInput')
export class AppTypeInput {
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  android?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  ios?: string;
}
