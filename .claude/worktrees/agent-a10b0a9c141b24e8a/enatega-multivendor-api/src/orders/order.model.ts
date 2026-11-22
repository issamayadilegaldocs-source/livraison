import { Field, Float, ID, Int, ObjectType } from '@nestjs/graphql';
import { GeoPointModel } from '../common/models/geo.model';

// ── Sub-types ──────────────────────────────────────────────────────────────

@ObjectType('OrderItemVariation')
export class OrderItemVariationModel {
  @Field(() => ID, { nullable: true }) _id?: string;
  @Field(() => ID, { nullable: true }) id?: string;
  @Field({ nullable: true }) title?: string;
  @Field(() => Float, { nullable: true }) price?: number;
  @Field(() => Float, { nullable: true }) discounted?: number;
}

@ObjectType('OrderItemAddonOption')
export class OrderItemAddonOptionModel {
  @Field(() => ID, { nullable: true }) _id?: string;
  @Field(() => ID, { nullable: true }) id?: string;
  @Field({ nullable: true }) title?: string;
  @Field({ nullable: true }) description?: string;
  @Field(() => Float, { nullable: true }) price?: number;
}

@ObjectType('OrderItemAddon')
export class OrderItemAddonModel {
  @Field(() => ID, { nullable: true }) _id?: string;
  @Field(() => ID, { nullable: true }) id?: string;
  @Field(() => [OrderItemAddonOptionModel], { nullable: true }) options?: OrderItemAddonOptionModel[];
  @Field({ nullable: true }) title?: string;
  @Field({ nullable: true }) description?: string;
  @Field(() => Int, { nullable: true }) quantityMinimum?: number;
  @Field(() => Int, { nullable: true }) quantityMaximum?: number;
}

@ObjectType('OrderItem')
export class OrderItemModel {
  @Field(() => ID, { nullable: true }) _id?: string;
  @Field(() => ID, { nullable: true }) id?: string;
  @Field({ nullable: true }) title?: string;
  @Field({ nullable: true }) food?: string;
  @Field({ nullable: true }) description?: string;
  @Field({ nullable: true }) image?: string;
  @Field(() => Int, { nullable: true }) quantity?: number;
  @Field(() => OrderItemVariationModel, { nullable: true }) variation?: OrderItemVariationModel;
  @Field(() => [OrderItemAddonModel], { nullable: true }) addons?: OrderItemAddonModel[];
  @Field({ nullable: true }) specialInstructions?: string;
  @Field({ nullable: true }) isActive?: boolean;
  @Field({ nullable: true }) createdAt?: string;
  @Field({ nullable: true }) updatedAt?: string;
}

@ObjectType('OrderDeliveryAddress')
export class OrderDeliveryAddressModel {
  @Field(() => ID, { nullable: true }) _id?: string;
  @Field(() => ID, { nullable: true }) id?: string;
  @Field(() => GeoPointModel, { nullable: true }) location?: GeoPointModel;
  @Field({ nullable: true }) deliveryAddress?: string;
  @Field({ nullable: true }) details?: string;
  @Field({ nullable: true }) label?: string;
}

@ObjectType('OrderRestaurant')
export class OrderRestaurantModel {
  @Field(() => ID) _id!: string;
  @Field({ nullable: true }) name?: string;
  @Field({ nullable: true }) image?: string;
  @Field({ nullable: true }) address?: string;
  @Field({ nullable: true }) slug?: string;
  @Field({ nullable: true }) shopType?: string;
  @Field(() => GeoPointModel, { nullable: true }) location?: GeoPointModel;
}

@ObjectType('OrderUser')
export class OrderUserModel {
  @Field(() => ID) _id!: string;
  @Field({ nullable: true }) name?: string;
  @Field({ nullable: true }) phone?: string;
  @Field({ nullable: true }) email?: string;
}

@ObjectType('OrderRider')
export class OrderRiderModel {
  @Field(() => ID) _id!: string;
  @Field({ nullable: true }) name?: string;
  @Field({ nullable: true }) username?: string;
  @Field({ nullable: true }) phone?: string;
  @Field({ nullable: true }) available?: boolean;
  @Field({ nullable: true }) image?: string;
}

@ObjectType('OrderReview')
export class OrderReviewModel {
  @Field(() => ID) _id!: string;
  @Field(() => Int, { nullable: true }) rating?: number;
  @Field({ nullable: true }) description?: string;
  @Field({ nullable: true }) isActive?: boolean;
  @Field({ nullable: true }) createdAt?: string;
  @Field({ nullable: true }) updatedAt?: string;
}

@ObjectType('OrderZone')
export class OrderZoneModel {
  @Field(() => ID) _id!: string;
}

@ObjectType('OrderStatusEvent')
export class OrderStatusEventModel {
  @Field({ nullable: true }) status?: string;
  @Field({ nullable: true }) at?: string;
  @Field({ nullable: true }) actor?: string;
  @Field({ nullable: true }) actorId?: string;
}

// ── Main Order type ────────────────────────────────────────────────────────

@ObjectType('Order')
export class OrderModel {
  @Field(() => ID) _id!: string;
  @Field(() => ID, { nullable: true }) id?: string;

  @Field({ nullable: true }) orderId?: string;

  @Field(() => OrderRestaurantModel, { nullable: true }) restaurant?: OrderRestaurantModel;
  @Field(() => OrderUserModel, { nullable: true }) user?: OrderUserModel;
  @Field(() => OrderRiderModel, { nullable: true }) rider?: OrderRiderModel;
  @Field(() => OrderReviewModel, { nullable: true }) review?: OrderReviewModel;
  @Field(() => OrderZoneModel, { nullable: true }) zone?: OrderZoneModel;

  @Field(() => [OrderItemModel], { nullable: true }) items?: OrderItemModel[];
  @Field(() => OrderDeliveryAddressModel, { nullable: true }) deliveryAddress?: OrderDeliveryAddressModel;

  @Field({ nullable: true }) paymentMethod?: string;
  @Field(() => Float, { nullable: true }) paidAmount?: number;
  @Field(() => Float, { nullable: true }) orderAmount?: number;

  @Field({ nullable: true }) orderStatus?: string;
  @Field({ nullable: true }) status?: string;
  @Field({ nullable: true }) paymentStatus?: string;
  @Field({ nullable: true }) paymentProvider?: string;
  @Field({ nullable: true }) paymentReference?: string;
  @Field({ nullable: true }) paymentLink?: string;
  @Field({ nullable: true }) paidAt?: string;

  @Field({ nullable: true }) reason?: string;
  @Field({ nullable: true }) isActive?: boolean;

  @Field(() => Float, { nullable: true }) subtotal?: number;
  @Field(() => Float, { nullable: true }) deliveryCharges?: number;
  @Field(() => Float, { nullable: true }) tipping?: number;
  @Field(() => Float, { nullable: true }) taxationAmount?: number;
  @Field(() => Float, { nullable: true }) discountAmount?: number;

  @Field({ nullable: true }) orderDate?: string;
  @Field({ nullable: true }) expectedTime?: string;
  @Field({ nullable: true }) completionTime?: string;
  @Field({ nullable: true }) preparationTime?: string;

  @Field({ nullable: true }) isPickedUp?: boolean;
  @Field({ nullable: true }) instructions?: string;

  @Field({ nullable: true }) acceptedAt?: string;
  @Field({ nullable: true }) pickedAt?: string;
  @Field({ nullable: true }) arrivedAt?: string;
  @Field({ nullable: true }) deliveredAt?: string;
  @Field({ nullable: true }) cancelledAt?: string;
  @Field({ nullable: true }) assignedAt?: string;
  @Field({ nullable: true }) codCollectedAt?: string;

  @Field(() => GeoPointModel, { nullable: true }) arrivalLocation?: GeoPointModel;
  @Field(() => [OrderStatusEventModel], { nullable: true }) statusHistory?: OrderStatusEventModel[];

  @Field({ nullable: true }) isRinged?: boolean;
  @Field({ nullable: true }) isRiderRinged?: boolean;

  @Field({ nullable: true }) preparedAt?: string;
  @Field({ nullable: true }) customerDeliveredAt?: string;
  @Field({ nullable: true }) riderDeliveredAt?: string;
  @Field(() => Float, { nullable: true }) riderCommission?: number;
  @Field(() => Float, { nullable: true }) deliveryBonus?: number;
  @Field(() => Float, { nullable: true }) riderEarnings?: number;
  @Field({ nullable: true }) walletCredited?: boolean;
  @Field({ nullable: true }) scheduledFor?: string;
  @Field({ nullable: true }) isExpress?: boolean;
  @Field(() => Float, { nullable: true }) expressSurcharge?: number;
  @Field(() => Float, { nullable: true }) serviceFee?: number;
  @Field(() => Int, { nullable: true }) loyaltyPointsUsed?: number;
  @Field(() => Float, { nullable: true }) loyaltyDiscount?: number;

  @Field({ nullable: true }) createdAt?: string;
  @Field({ nullable: true }) updatedAt?: string;
}

// ── Pagination / aggregation types ────────────────────────────────────────

@ObjectType('OrdersByUserResult')
export class OrdersByUserResultModel {
  @Field(() => [OrderModel]) orders!: OrderModel[];
  @Field(() => Int) totalCount!: number;
  @Field(() => Int) totalPages!: number;
  @Field(() => Int) currentPage!: number;
  @Field({ nullable: true }) prevPage?: boolean;
  @Field({ nullable: true }) nextPage?: boolean;
}

@ObjectType('ActiveOrdersResult')
export class ActiveOrdersResultModel {
  @Field(() => Int) totalCount!: number;
  @Field(() => [OrderModel]) orders!: OrderModel[];
}

@ObjectType('AllOrdersPaginated')
export class AllOrdersPaginatedModel {
  @Field(() => Int) totalCount!: number;
  @Field(() => Int) currentPage!: number;
  @Field(() => Int) totalPages!: number;
  @Field({ nullable: true }) prevPage?: boolean;
  @Field({ nullable: true }) nextPage?: boolean;
  @Field(() => [OrderModel]) orders!: OrderModel[];
}
