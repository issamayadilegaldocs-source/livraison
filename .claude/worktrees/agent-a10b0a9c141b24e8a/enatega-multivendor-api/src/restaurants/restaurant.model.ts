import { Field, Float, ID, Int, ObjectType } from '@nestjs/graphql';
import { GeoPointModel, GeoPolygonModel, CircleBoundsModel } from '../common/models/geo.model';
import { ZoneModel } from '../zones/zone.model';

// ── Catalog ObjectTypes ──────────────────────────────────────────────────────

@ObjectType('Variation')
export class VariationModel {
  @Field(() => ID, { nullable: true }) _id?: string;
  @Field({ nullable: true }) title?: string;
  @Field(() => Float, { nullable: true }) price?: number;
  @Field(() => Float, { nullable: true }) discounted?: number;
  @Field(() => [String], { nullable: true }) addons?: string[];
  @Field({ nullable: true }) isOutOfStock?: boolean;
}

@ObjectType('Food')
export class FoodModel {
  @Field(() => ID, { nullable: true }) _id?: string;
  @Field({ nullable: true }) title?: string;
  @Field({ nullable: true }) description?: string;
  @Field({ nullable: true }) image?: string;
  @Field({ nullable: true }) subCategory?: string;
  @Field({ nullable: true }) isActive?: boolean;
  @Field({ nullable: true }) isOutOfStock?: boolean;
  @Field(() => [VariationModel], { nullable: true }) variations?: VariationModel[];
  @Field({ nullable: true }) createdAt?: string;
  @Field({ nullable: true }) updatedAt?: string;
}

@ObjectType('Category')
export class CategoryModel {
  @Field(() => ID, { nullable: true }) _id?: string;
  @Field({ nullable: true }) title?: string;
  @Field({ nullable: true }) image?: string;
  @Field(() => [FoodModel], { nullable: true }) foods?: FoodModel[];
  @Field({ nullable: true }) createdAt?: string;
  @Field({ nullable: true }) updatedAt?: string;
}

@ObjectType('Option')
export class OptionModel {
  @Field(() => ID, { nullable: true }) _id?: string;
  @Field({ nullable: true }) title?: string;
  @Field({ nullable: true }) description?: string;
  @Field(() => Float, { nullable: true }) price?: number;
}

@ObjectType('Addon')
export class AddonModel {
  @Field(() => ID, { nullable: true }) _id?: string;
  @Field({ nullable: true }) title?: string;
  @Field({ nullable: true }) description?: string;
  @Field(() => Int, { nullable: true }) quantityMinimum?: number;
  @Field(() => Int, { nullable: true }) quantityMaximum?: number;
  @Field(() => [String], { nullable: true }) options?: string[];
}

// ── Supporting sub-types ─────────────────────────────────────────────────────

@ObjectType('RestaurantTimeSlot')
export class TimeSlotModel {
  @Field({ nullable: true }) startTime?: string;
  @Field({ nullable: true }) endTime?: string;
}

@ObjectType('OpeningTime')
export class OpeningTimeModel {
  @Field({ nullable: true }) day?: string;
  @Field(() => [TimeSlotModel], { nullable: true }) times?: TimeSlotModel[];
}

@ObjectType('DeliveryInfo')
export class DeliveryInfoModel {
  @Field(() => Float, { nullable: true }) minDeliveryFee?: number;
  @Field(() => Float, { nullable: true }) deliveryDistance?: number;
  @Field(() => Float, { nullable: true }) deliveryFee?: number;
}

@ObjectType('DeliveryOptions')
export class DeliveryOptionsModel {
  @Field({ nullable: true }) delivery?: boolean;
  @Field({ nullable: true }) pickup?: boolean;
}

@ObjectType('BussinessDetails')
export class BussinessDetailsModel {
  @Field({ nullable: true }) bankName?: string;
  @Field({ nullable: true }) accountName?: string;
  @Field({ nullable: true }) accountCode?: string;
  @Field({ nullable: true }) accountNumber?: string;
  @Field({ nullable: true }) bussinessRegNo?: string;
  @Field({ nullable: true }) companyRegNo?: string;
  @Field(() => Float, { nullable: true }) taxRate?: number;
}

@ObjectType('RestaurantOwner')
export class RestaurantOwnerModel {
  @Field(() => ID) _id!: string;
  @Field({ nullable: true }) email?: string;
  @Field({ nullable: true }) isActive?: boolean;
}

// ── ReviewsByRestaurant (must be declared before RestaurantModel uses it) ────

@ObjectType('ReviewUser')
export class ReviewUserModel {
  @Field(() => ID) _id!: string;
  @Field({ nullable: true }) name?: string;
  @Field({ nullable: true }) email?: string;
}

@ObjectType('ReviewOrderRef')
export class ReviewOrderRefModel {
  @Field(() => ID) _id!: string;
  @Field(() => ReviewUserModel, { nullable: true }) user?: ReviewUserModel;
}

@ObjectType('ReviewRestaurantRef')
export class ReviewRestaurantRefModel {
  @Field(() => ID) _id!: string;
  @Field({ nullable: true }) name?: string;
}

@ObjectType('RestaurantReview')
export class RestaurantReviewModel {
  @Field(() => ID) _id!: string;
  @Field(() => Int, { nullable: true }) rating?: number;
  @Field({ nullable: true }) description?: string;
  @Field({ nullable: true }) comments?: string;
  @Field({ nullable: true }) isActive?: boolean;
  @Field({ nullable: true }) createdAt?: string;
  @Field({ nullable: true }) updatedAt?: string;
  @Field(() => ReviewOrderRefModel, { nullable: true }) order?: ReviewOrderRefModel;
  @Field(() => ReviewRestaurantRefModel, { nullable: true }) restaurant?: ReviewRestaurantRefModel;
}

@ObjectType('ReviewsByRestaurantResult')
export class ReviewsByRestaurantResultModel {
  @Field(() => [RestaurantReviewModel]) reviews!: RestaurantReviewModel[];
  @Field(() => Float, { nullable: true }) ratings?: number;
  @Field(() => Int, { nullable: true }) total?: number;
}

// ── Main Restaurant type ─────────────────────────────────────────────────────

@ObjectType('Restaurant')
export class RestaurantModel {
  @Field(() => ID) _id!: string;

  @Field({ nullable: true }) unique_restaurant_id?: string;
  @Field(() => Int, { nullable: true }) orderId?: number;
  @Field({ nullable: true }) orderPrefix?: string;
  @Field({ nullable: true }) name?: string;
  @Field({ nullable: true }) image?: string;
  @Field({ nullable: true }) logo?: string;
  @Field({ nullable: true }) slug?: string;
  @Field({ nullable: true }) phone?: string;
  @Field({ nullable: true }) address?: string;
  @Field({ nullable: true }) city?: string;
  @Field({ nullable: true }) postCode?: string;

  @Field(() => GeoPointModel, { nullable: true }) location?: GeoPointModel;
  @Field(() => GeoPolygonModel, { nullable: true }) deliveryBounds?: GeoPolygonModel;
  @Field(() => CircleBoundsModel, { nullable: true }) circleBounds?: CircleBoundsModel;
  @Field({ nullable: true }) boundType?: string;

  @Field(() => DeliveryInfoModel, { nullable: true }) deliveryInfo?: DeliveryInfoModel;
  @Field(() => Int, { nullable: true }) deliveryTime?: number;
  @Field(() => Float, { nullable: true }) minimumOrder?: number;
  @Field(() => Float, { nullable: true }) tax?: number;
  @Field(() => Float, { nullable: true }) salesTax?: number;
  @Field(() => Float, { nullable: true }) commissionRate?: number;

  @Field({ nullable: true }) username?: string;
  @Field({ nullable: true }) password?: string;

  @Field({ nullable: true }) isActive?: boolean;
  @Field({ nullable: true }) isAvailable?: boolean;
  @Field({ nullable: true }) unavailableUntil?: string;
  @Field({ nullable: true }) stripeDetailsSubmitted?: boolean;
  @Field({ nullable: true }) enableNotification?: boolean;
  @Field({ nullable: true }) notificationToken?: string;

  @Field(() => [OpeningTimeModel], { nullable: true }) openingTimes?: OpeningTimeModel[];
  // Auto-derived IANA zone + server-computed open/closed status (single source
  // of truth consumed by all clients). Resolved via a field resolver.
  @Field({ nullable: true }) timezone?: string;
  @Field({ nullable: true }) isOpen?: boolean;
  @Field({ nullable: true }) nextOpenAt?: string;
  @Field(() => RestaurantOwnerModel, { nullable: true }) owner?: RestaurantOwnerModel;

  @Field({ nullable: true }) shopType?: string;
  @Field({ nullable: true }) shopCategory?: string;
  @Field(() => [String], { nullable: true }) cuisines?: string[];
  @Field(() => [String], { nullable: true }) sections?: string[];
  @Field(() => [String], { nullable: true }) keywords?: string[];
  @Field(() => [String], { nullable: true }) tags?: string[];

  @Field(() => BussinessDetailsModel, { nullable: true }) bussinessDetails?: BussinessDetailsModel;
  @Field(() => DeliveryOptionsModel, { nullable: true }) deliveryOptions?: DeliveryOptionsModel;

  @Field(() => Float, { nullable: true }) currentWalletAmount?: number;
  @Field(() => Float, { nullable: true }) totalWalletAmount?: number;
  @Field(() => Float, { nullable: true }) withdrawnWalletAmount?: number;
  @Field(() => Float, { nullable: true }) rating?: number;

  @Field(() => [CategoryModel], { nullable: true }) categories?: CategoryModel[];
  @Field(() => [OptionModel], { nullable: true }) options?: OptionModel[];
  @Field(() => [AddonModel], { nullable: true }) addons?: AddonModel[];
  @Field(() => ReviewsByRestaurantResultModel, { nullable: true }) reviewData?: ReviewsByRestaurantResultModel;

  @Field(() => Int, { nullable: true }) reviewCount?: number;
  @Field(() => Float, { nullable: true }) reviewAverage?: number;

  @Field(() => ZoneModel, { nullable: true }) zone?: ZoneModel;
  @Field({ nullable: true }) restaurantUrl?: string;
}

// ── Restaurant Preview (lightweight listing type) ────────────────────────────

@ObjectType('RestaurantPreview')
export class RestaurantPreviewModel {
  @Field(() => ID) _id!: string;
  @Field(() => Int, { nullable: true }) orderId?: number;
  @Field({ nullable: true }) orderPrefix?: string;
  @Field({ nullable: true }) name?: string;
  @Field({ nullable: true }) image?: string;
  @Field({ nullable: true }) logo?: string;
  @Field({ nullable: true }) address?: string;
  @Field({ nullable: true }) username?: string;
  @Field({ nullable: true }) password?: string;
  @Field(() => Int, { nullable: true }) deliveryTime?: number;
  @Field(() => Float, { nullable: true }) minimumOrder?: number;
  @Field(() => [String], { nullable: true }) sections?: string[];
  @Field(() => Float, { nullable: true }) rating?: number;
  @Field({ nullable: true }) isActive?: boolean;
  @Field({ nullable: true }) isAvailable?: boolean;
  @Field({ nullable: true }) slug?: string;
  @Field({ nullable: true }) stripeDetailsSubmitted?: boolean;
  @Field(() => Float, { nullable: true }) commissionRate?: number;
  @Field(() => Float, { nullable: true }) tax?: number;
  @Field(() => Float, { nullable: true }) salesTax?: number;
  @Field({ nullable: true }) notificationToken?: string;
  @Field({ nullable: true }) enableNotification?: boolean;
  @Field({ nullable: true }) shopType?: string;
  @Field({ nullable: true }) shopCategory?: string;
  @Field(() => [String], { nullable: true }) cuisines?: string[];
  @Field(() => [String], { nullable: true }) keywords?: string[];
  @Field(() => [String], { nullable: true }) tags?: string[];
  @Field(() => Int, { nullable: true }) reviewCount?: number;
  @Field(() => Float, { nullable: true }) reviewAverage?: number;
  @Field(() => GeoPointModel, { nullable: true }) location?: GeoPointModel;
  @Field(() => [OpeningTimeModel], { nullable: true }) openingTimes?: OpeningTimeModel[];
  @Field(() => DeliveryInfoModel, { nullable: true }) deliveryInfo?: DeliveryInfoModel;
  // Same server-computed open/closed contract as RestaurantModel — most listing
  // queries return this preview type, so it must carry the field too.
  @Field({ nullable: true }) timezone?: string;
  @Field({ nullable: true }) isOpen?: boolean;
  @Field({ nullable: true }) nextOpenAt?: string;
}

// ── Pagination / aggregation types ──────────────────────────────────────────

@ObjectType('RestaurantsPaginated')
export class RestaurantsPaginatedModel {
  @Field(() => [RestaurantModel]) data!: RestaurantModel[];
  @Field(() => Int) totalCount!: number;
  @Field(() => Int) currentPage!: number;
  @Field(() => Int) totalPages!: number;
}

@ObjectType('OwnerWithRestaurants')
export class OwnerWithRestaurantsModel {
  @Field(() => ID) _id!: string;
  @Field({ nullable: true }) email?: string;
  @Field({ nullable: true }) userType?: string;
  @Field(() => [RestaurantModel], { nullable: true }) restaurants?: RestaurantModel[];
}

@ObjectType('RestaurantDeliveryZoneInfo')
export class RestaurantDeliveryZoneInfoModel {
  @Field({ nullable: true }) boundType?: string;
  @Field(() => GeoPolygonModel, { nullable: true }) deliveryBounds?: GeoPolygonModel;
  @Field(() => GeoPointModel, { nullable: true }) location?: GeoPointModel;
  @Field(() => CircleBoundsModel, { nullable: true }) circleBounds?: CircleBoundsModel;
  @Field({ nullable: true }) address?: string;
  @Field({ nullable: true }) city?: string;
  @Field({ nullable: true }) postCode?: string;
}

@ObjectType('NearBySection')
export class NearBySectionModel {
  @Field(() => ID) _id!: string;
  @Field({ nullable: true }) name?: string;
  @Field(() => [String], { nullable: true }) restaurants?: string[];
}

@ObjectType('NearByOffer')
export class NearByOfferModel {
  @Field(() => ID) _id!: string;
  @Field({ nullable: true }) name?: string;
  @Field({ nullable: true }) tag?: string;
  @Field(() => [String], { nullable: true }) restaurants?: string[];
}

@ObjectType('NearByRestaurantsResult')
export class NearByRestaurantsResultModel {
  @Field(() => [NearByOfferModel]) offers!: NearByOfferModel[];
  @Field(() => [NearBySectionModel]) sections!: NearBySectionModel[];
  @Field(() => [RestaurantModel]) restaurants!: RestaurantModel[];
}

@ObjectType('MutationResult')
export class MutationResultModel {
  @Field() success!: boolean;
  @Field({ nullable: true }) message?: string;
  @Field(() => RestaurantModel, { nullable: true }) data?: RestaurantModel;
}

@ObjectType('CommissionRatePaginated')
export class CommissionRatePaginatedModel {
  @Field(() => [RestaurantModel]) restaurant!: RestaurantModel[];
  @Field(() => Int, { nullable: true }) currentPage?: number;
  @Field(() => Int, { nullable: true }) totalPages?: number;
  @Field({ nullable: true }) nextPage?: boolean;
  @Field({ nullable: true }) prevPage?: boolean;
}

@ObjectType('PopularItem')
export class PopularItemModel {
  @Field() id!: string;
  @Field(() => Int) count!: number;
}

@ObjectType('CategoryDetailMobile')
export class CategoryDetailMobileModel {
  @Field() id!: string;
  @Field({ nullable: true }) category_name?: string;
  @Field({ nullable: true }) url?: string;
  @Field({ nullable: true }) food_id?: string;
}

@ObjectType('NearByRestaurantsPreviewResult')
export class NearByRestaurantsPreviewResultModel {
  @Field(() => [NearByOfferModel], { nullable: true }) offers?: NearByOfferModel[];
  @Field(() => [NearBySectionModel], { nullable: true }) sections?: NearBySectionModel[];
  @Field(() => [RestaurantPreviewModel]) restaurants!: RestaurantPreviewModel[];
}

// ── CategoryDetail (web store page) ─────────────────────────────────────────

@ObjectType('CategoryDetailItem')
export class CategoryDetailItemModel {
  @Field() id!: string;
  @Field({ nullable: true }) label?: string;
  @Field({ nullable: true }) url?: string;
}

@ObjectType('CategoryDetail')
export class CategoryDetailModel {
  @Field() id!: string;
  @Field({ nullable: true }) label?: string;
  @Field({ nullable: true }) url?: string;
  @Field(() => [CategoryDetailItemModel], { nullable: true }) items?: CategoryDetailItemModel[];
}
