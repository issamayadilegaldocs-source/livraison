import { registerEnumType } from '@nestjs/graphql';
import { Field, Float, ID, Int, ObjectType } from '@nestjs/graphql';

export enum UserTypeEnum {
  RIDER = 'RIDER',
  RESTAURANT = 'RESTAURANT',
  STORE = 'STORE',
}

export enum OrderTypeEnum {
  DELIVERY = 'DELIVERY',
  PICK_UP = 'PICK_UP',
}

export enum PaymentMethodEnum {
  CASH = 'CASH',
  CARD = 'CARD',
  STRIPE = 'STRIPE',
  PAYPAL = 'PAYPAL',
}

registerEnumType(UserTypeEnum, { name: 'UserTypeEnum' });
registerEnumType(OrderTypeEnum, { name: 'OrderTypeEnum' });
registerEnumType(PaymentMethodEnum, { name: 'PaymentMethodEnum' });

@ObjectType()
export class EarningOrderDetail {
  @Field({ nullable: true }) orderId?: string;
  @Field({ nullable: true }) orderType?: string;
  @Field({ nullable: true }) paymentMethod?: string;
}

@ObjectType()
export class RiderEarningDay {
  @Field({ nullable: true }) date?: string;
  @Field(() => Float, { nullable: true }) tip?: number;
  @Field(() => Float, { nullable: true }) deliveryFee?: number;
  @Field(() => Float, { nullable: true }) totalEarnings?: number;
  @Field(() => Int, { nullable: true }) totalDeliveries?: number;
  @Field(() => Float, { nullable: true }) totalEarningsSum?: number;
  @Field(() => Float, { nullable: true }) totalTipsSum?: number;
  @Field(() => Float, { nullable: true }) totalHours?: number;
  @Field(() => [EarningOrderDetail], { nullable: true }) orderDetails?: EarningOrderDetail[];
}

@ObjectType()
export class RiderEarningEntry {
  @Field({ nullable: true }) date?: string;
  @Field(() => Float, { nullable: true }) tip?: number;
  @Field(() => Float, { nullable: true }) deliveryFee?: number;
  // Rider's delivery commission (excludes tip and bonus).
  @Field(() => Float, { nullable: true }) commission?: number;
  // Platform-funded bonus paid on top of the commission.
  @Field(() => Float, { nullable: true }) deliveryBonus?: number;
  @Field(() => Float, { nullable: true }) totalEarnings?: number;
  @Field(() => EarningOrderDetail, { nullable: true }) orderDetails?: EarningOrderDetail;
}

@ObjectType()
export class RiderEarningsGrouped {
  @Field({ nullable: true }) _id?: string;
  @Field({ nullable: true }) date?: string;
  @Field(() => [RiderEarningEntry], { nullable: true }) earningsArray?: RiderEarningEntry[];
  @Field(() => Int, { nullable: true }) totalDeliveries?: number;
  @Field(() => Float, { nullable: true }) totalEarningsSum?: number;
  @Field(() => Float, { nullable: true }) totalTipsSum?: number;
  @Field(() => Float, { nullable: true }) totalHours?: number;
}

@ObjectType()
export class RiderEarningsGraphResult {
  @Field(() => Int, { nullable: true }) totalCount?: number;
  @Field(() => [RiderEarningsGrouped], { nullable: true }) earnings?: RiderEarningsGrouped[];
}

@ObjectType()
export class StoreEarningDay {
  @Field({ nullable: true }) date?: string;
  @Field(() => Float, { nullable: true }) totalOrderAmount?: number;
  @Field(() => Float, { nullable: true }) totalEarnings?: number;
  @Field(() => [EarningOrderDetail], { nullable: true }) orderDetails?: EarningOrderDetail[];
}

@ObjectType()
export class StoreEarningsEntry {
  @Field(() => EarningOrderDetail, { nullable: true }) orderDetails?: EarningOrderDetail;
  @Field(() => Float, { nullable: true }) totalOrderAmount?: number;
  @Field(() => Float, { nullable: true }) totalEarnings?: number;
  @Field({ nullable: true }) date?: string;
}

@ObjectType()
export class StoreEarningGrouped {
  @Field({ nullable: true }) _id?: string;
  @Field({ nullable: true }) date?: string;
  @Field(() => Float, { nullable: true }) totalEarningsSum?: number;
  @Field(() => Float, { nullable: true }) totalOrderAmount?: number;
  @Field(() => Int, { nullable: true }) totalDeliveries?: number;
  @Field(() => [StoreEarningsEntry], { nullable: true }) earningsArray?: StoreEarningsEntry[];
}

@ObjectType()
export class StoreEarningsGraphResult {
  @Field(() => Int, { nullable: true }) totalCount?: number;
  @Field(() => [StoreEarningGrouped], { nullable: true }) earnings?: StoreEarningGrouped[];
}

@ObjectType()
export class GrandTotalEarnings {
  @Field(() => Float, { nullable: true }) riderTotal?: number;
  @Field(() => Float, { nullable: true }) storeTotal?: number;
}

@ObjectType()
export class GrandTotalEarningsResult {
  @Field(() => GrandTotalEarnings, { nullable: true }) grandTotalEarnings?: GrandTotalEarnings;
  @Field({ nullable: true }) message?: string;
}

@ObjectType()
export class GrandTotalWrapper {
  @Field(() => GrandTotalEarningsResult, { nullable: true }) earnings?: GrandTotalEarningsResult;
}

@ObjectType()
export class PlatformEarnings {
  @Field(() => Float, { nullable: true }) marketplaceCommission?: number;
  @Field(() => Float, { nullable: true }) deliveryCommission?: number;
  @Field(() => Float, { nullable: true }) tax?: number;
  // Customer service fee collected on this order (platform income).
  @Field(() => Float, { nullable: true }) serviceFee?: number;
  // Promo discount the platform absorbs (subtotal − discounted food) × storeRate,
  // i.e. the difference between paying the store on the full subtotal vs the
  // discounted food. Negative pressure on the platform total.
  @Field(() => Float, { nullable: true }) promoFunding?: number;
  // Platform-funded rider bonus paid out on this order.
  @Field(() => Float, { nullable: true }) deliveryBonus?: number;
  @Field(() => Float, { nullable: true }) platformFee?: number;
  @Field(() => Float, { nullable: true }) totalEarnings?: number;
}

@ObjectType()
export class EarningUserRef {
  @Field(() => ID, { nullable: true }) _id?: string;
  @Field({ nullable: true }) name?: string;
  @Field({ nullable: true }) username?: string;
}

@ObjectType()
export class EarningRecordRider {
  @Field(() => EarningUserRef, { nullable: true }) riderId?: EarningUserRef;
  @Field(() => Float, { nullable: true }) deliveryFee?: number;
  @Field(() => Float, { nullable: true }) tip?: number;
  // Platform-funded bonus paid on top of commission + tip.
  @Field(() => Float, { nullable: true }) deliveryBonus?: number;
  @Field(() => Float, { nullable: true }) totalEarnings?: number;
}

@ObjectType()
export class EarningRecordStore {
  @Field(() => EarningUserRef, { nullable: true }) storeId?: EarningUserRef;
  @Field(() => Float, { nullable: true }) orderAmount?: number;
  @Field(() => Float, { nullable: true }) totalEarnings?: number;
}

@ObjectType()
export class GrandTotalAllEarnings {
  @Field(() => Float, { nullable: true }) platformTotal?: number;
  @Field(() => Float, { nullable: true }) riderTotal?: number;
  @Field(() => Float, { nullable: true }) storeTotal?: number;
}

/** One row per delivered order, matching the legacy admin earnings table. */
@ObjectType()
export class EarningRecord {
  @Field(() => ID, { nullable: true }) _id?: string;
  @Field({ nullable: true }) orderId?: string;
  @Field({ nullable: true }) orderType?: string;
  @Field({ nullable: true }) paymentMethod?: string;
  @Field({ nullable: true }) createdAt?: string;
  @Field({ nullable: true }) updatedAt?: string;
  @Field(() => PlatformEarnings, { nullable: true }) platformEarnings?: PlatformEarnings;
  @Field(() => EarningRecordRider, { nullable: true }) riderEarnings?: EarningRecordRider;
  @Field(() => EarningRecordStore, { nullable: true }) storeEarnings?: EarningRecordStore;
  @Field(() => GrandTotalAllEarnings, { nullable: true }) grandTotalEarnings?: GrandTotalAllEarnings;
}

@ObjectType()
export class EarningsData {
  @Field(() => [EarningRecord], { nullable: true }) earnings?: EarningRecord[];
  @Field(() => GrandTotalAllEarnings, { nullable: true }) grandTotalEarnings?: GrandTotalAllEarnings;
  @Field({ nullable: true }) message?: string;
}

@ObjectType()
export class EarningsPaginationMeta {
  @Field(() => Int, { nullable: true }) total?: number;
}

@ObjectType()
export class EarningsResponse {
  @Field({ nullable: true }) success?: boolean;
  @Field({ nullable: true }) message?: string;
  @Field(() => EarningsData, { nullable: true }) data?: EarningsData;
  @Field(() => EarningsPaginationMeta, { nullable: true }) pagination?: EarningsPaginationMeta;
}
