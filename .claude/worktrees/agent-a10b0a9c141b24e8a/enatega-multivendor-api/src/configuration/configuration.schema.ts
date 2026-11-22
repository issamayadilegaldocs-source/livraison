import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { DeliveryTimeEstimationMode } from '../delivery-estimation/dto/delivery-time-estimation-mode.enum';

export type ConfigurationDocument = HydratedDocument<Configuration>;

/**
 * Persisted non-secret runtime configuration. There is exactly one document;
 * provider credentials and SDK keys are sourced from environment variables.
 */
@Schema({ collection: 'configurations', timestamps: true })
export class Configuration {
  // --- Currency / delivery ---
  @Prop({ default: 'USD' }) currency?: string;
  @Prop({ default: '$' }) currencySymbol?: string;
  // Decimal places for money formatting. 2 for most currencies; 3 for the
  // Tunisian Dinar and other millime/fils currencies (TND, KWD, BHD, OMR).
  @Prop({ default: 2 }) currencyDecimalDigits?: number;
  @Prop({ default: 0 }) deliveryRate?: number;
  @Prop() deliveryRateMinor?: number;
  @Prop({ default: 'fixed' }) costType?: string;
  @Prop({ default: 0 }) baseDeliveryFee?: number;
  @Prop() baseDeliveryFeeMinor?: number;
  @Prop({ default: 0 }) baseDeliveryDistance?: number;
  // Optional post-computation shaping of the delivery fee (applied by
  // delivery-fee.ts#normalizeFee, mirrored client-side). 0 = disabled.
  @Prop({ default: 0 }) deliveryFeeMinimum?: number; // floor, 0 = no floor
  @Prop() deliveryFeeMinimumMinor?: number;
  @Prop({ default: 0 }) deliveryFeeMaximum?: number; // cap, 0 = no cap
  @Prop() deliveryFeeMaximumMinor?: number;
  // Round the raw fee to the nearest multiple (e.g. 0.5 TND). 0 = no rounding.
  @Prop({ default: 0 }) deliveryRoundToNearest?: number;
  @Prop({ enum: DeliveryTimeEstimationMode, default: DeliveryTimeEstimationMode.STATIC })
  deliveryTimeEstimationMode?: DeliveryTimeEstimationMode;

  @Prop({ default: false }) skipWhatsAppOTP?: boolean;

  // --- Legal / misc ---
  @Prop() termsAndConditions?: string;
  @Prop() privacyPolicy?: string;
  @Prop() testOtp?: string;
  @Prop({ default: true }) isPaidVersion?: boolean;
  @Prop({ default: false }) skipEmailVerification?: boolean;
  @Prop({ default: false }) skipMobileVerification?: boolean;

  // --- Demo toggles ---
  @Prop({ default: false }) enableRiderDemo?: boolean;
  @Prop({ default: false }) enableRestaurantDemo?: boolean;
  @Prop({ default: false }) enableAdminDemo?: boolean;

  // --- Finance ---
  @Prop({ default: 0.25 }) maxTipPercentage?: number;

  // --- Customer service fee ---
  // A per-order platform fee charged to the customer, computed on the discounted
  // food amount: fee = clamp(serviceFeeRate × food, serviceFeeMinimum, serviceFeeMaximum).
  // serviceFeeRate is a fraction (0.07 = 7%). Maximum 0 = uncapped. Opt-in.
  @Prop({ default: false }) serviceFeeEnabled?: boolean;
  @Prop({ default: 0 }) serviceFeeRate?: number;
  @Prop({ default: 0 }) serviceFeeMinimum?: number;
  @Prop() serviceFeeMinimumMinor?: number;
  @Prop({ default: 0 }) serviceFeeMaximum?: number; // 0 = no cap
  @Prop() serviceFeeMaximumMinor?: number;

  // --- Rider commission ---
  @Prop({ default: 0.8 }) riderCommissionRate?: number;

  // --- Rider delivery bonus (platform-funded, not charged to the customer) ---
  // Default per-order bonus = perKm × max(0, distanceKm − freeDistance), capped
  // at max (0 = uncapped). Admin can override per order. Opt-in.
  @Prop({ default: false }) deliveryBonusEnabled?: boolean;
  @Prop({ default: 0 }) deliveryBonusPerKm?: number;
  @Prop({ default: 0 }) deliveryBonusFreeDistance?: number;
  @Prop({ default: 0 }) deliveryBonusMax?: number;
  @Prop() deliveryBonusMaxMinor?: number;
  // Hours after the rider marks delivery before the order auto-confirms (so the
  // rider is paid even if the customer never confirms). Default 24h; set 0 to disable.
  @Prop({ default: 24 }) deliveryAutoConfirmHours?: number;

  // --- Delivery arrival step (ARRIVED status) ---
  // When true, a PICKED order must pass through ARRIVED before it can be marked
  // DELIVERED. Disable to fall back to the previous PICKED → DELIVERED flow.
  @Prop({ default: true }) requireArrivedStep?: boolean;
  // When true, marking ARRIVED requires the rider's last-known live location
  // (tracking's per-order Redis key) to be within arrivalGpsRadiusMeters of the
  // delivery address. If either location is unavailable, the check is skipped
  // rather than blocking the rider — GPS/Redis availability is best-effort.
  @Prop({ default: false }) enforceArrivalGps?: boolean;
  @Prop({ default: 100 }) arrivalGpsRadiusMeters?: number;

  // --- OTP / SMS settings ---
  @Prop({ default: 600 }) otpExpirationSeconds?: number;
  @Prop({ default: 3 }) otpMaxAttempts?: number;
  @Prop({ default: 6 }) otpCodeLength?: number;

  // --- Express delivery ---
  @Prop({ default: 0 }) expressSurcharge?: number;
  @Prop() expressSurchargeMinor?: number;
  @Prop({ default: true }) expressEnabled?: boolean;

  // --- Loyalty program ---
  @Prop({ default: 10 }) loyaltyPointsPerUnit?: number;
  @Prop({ default: 100 }) loyaltyPointsRedemptionRate?: number;
  @Prop({ default: true }) loyaltyEnabled?: boolean;

  // --- App versions ---
  @Prop({ type: { android: String, ios: String } })
  customerAppVersion?: { android?: string; ios?: string };

  @Prop({ type: { android: String, ios: String } })
  riderAppVersion?: { android?: string; ios?: string };

  @Prop({ type: { android: String, ios: String } })
  restaurantAppVersion?: { android?: string; ios?: string };
}

export const ConfigurationSchema = SchemaFactory.createForClass(Configuration);
