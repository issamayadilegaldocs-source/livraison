import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type RestaurantDocument = HydratedDocument<Restaurant>;

// Catalog (categories, foods+variations, addons, options) lives in its own
// collections owned by CatalogService (slice 4b) — see `src/restaurants/catalog/`.
// It is no longer embedded here; `Restaurant.categories/.addons/.options` are
// resolved lazily via field resolvers on the GraphQL `Restaurant` type.

// ── Geo sub-documents ───────────────────────────────────────────────────────
// Defined as proper single-nested subdocuments (not inline nested paths) so
// Mongoose leaves them `undefined` when unset instead of auto-creating an empty
// `{}` — which would otherwise surface as a GeoPoint with null coordinates and
// break the non-nullable `GeoPoint.coordinates` GraphQL field.

@Schema({ _id: false })
class GeoPoint {
  @Prop({ type: String, enum: ['Point'], default: 'Point' })
  type?: string;

  @Prop({ type: [Number] })
  coordinates?: number[];
}

@Schema({ _id: false })
class GeoPolygon {
  @Prop({ type: String, enum: ['Polygon'], default: 'Polygon' })
  type?: string;

  @Prop({ type: [[[Number]]] })
  coordinates?: number[][][];
}

// ── Delivery / schedule sub-documents ───────────────────────────────────────

@Schema({ _id: false })
class TimeSlot {
  @Prop() startTime?: string;
  @Prop() endTime?: string;
}

@Schema({ _id: false })
class OpeningTime {
  @Prop() day?: string;
  @Prop({ type: [TimeSlot], default: [] }) times?: TimeSlot[];
}

@Schema({ _id: false })
class DeliveryInfo {
  @Prop() minDeliveryFee?: number;
  @Prop() deliveryDistance?: number;
  @Prop() deliveryFee?: number;
}

@Schema({ _id: false })
class BussinessDetails {
  @Prop() bankName?: string;
  @Prop() accountName?: string;
  @Prop() accountCode?: string;
  @Prop() accountNumber?: string;
  @Prop() bussinessRegNo?: string;
  @Prop() companyRegNo?: string;
  @Prop() taxRate?: number;
}

@Schema({ collection: 'restaurants', timestamps: true })
export class Restaurant {
  @Prop() unique_restaurant_id?: string;

  @Prop() orderId?: number;

  @Prop() orderPrefix?: string;

  @Prop({ required: true }) name!: string;

  @Prop() image?: string;

  @Prop() logo?: string;

  @Prop({ unique: true, sparse: true }) slug?: string;

  @Prop() phone?: string;

  @Prop() address?: string;

  @Prop() city?: string;

  @Prop() postCode?: string;

  @Prop({ type: GeoPoint, default: undefined })
  location?: GeoPoint;

  @Prop({ type: GeoPolygon, default: undefined })
  deliveryBounds?: GeoPolygon;

  @Prop({ type: DeliveryInfo }) deliveryInfo?: DeliveryInfo;

  @Prop() deliveryTime?: number;

  @Prop() minimumOrder?: number;

  @Prop() tax?: number;

  @Prop() salesTax?: number;

  @Prop() commissionRate?: number;

  @Prop({ trim: true, index: true }) username?: string;

  @Prop({ select: false }) password?: string;

  // Unique + sparse: at most one restaurant may bind a given Clerk identity,
  // while restaurants without a per-store login (clerkId unset) are exempt.
  @Prop({ type: String, unique: true, sparse: true }) clerkId?: string;

  @Prop({ default: true }) isActive?: boolean;

  @Prop({ default: true }) isAvailable?: boolean;

  // When the store pauses with a timer, this holds the moment it should
  // automatically flip isAvailable back to true. Null = paused indefinitely
  // (until the store manually re-enables) or not currently paused.
  @Prop({ type: Date, default: null }) unavailableUntil?: Date | null;

  @Prop({ default: false }) stripeDetailsSubmitted?: boolean;

  @Prop({ default: false }) enableNotification?: boolean;

  @Prop({ index: true, sparse: true }) notificationToken?: string;

  @Prop({ type: [OpeningTime], default: [] }) openingTimes?: OpeningTime[];

  // IANA timezone (e.g. 'Europe/Berlin'), auto-derived from `location` via the
  // Google Time Zone API. Mirrors the rider `timeZone` field. When unset, the
  // open/closed evaluator falls back to the configured default zone.
  @Prop() timezone?: string;

  @Prop({ type: Types.ObjectId, ref: 'Owner' }) owner?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Zone' }) zone?: Types.ObjectId;

  @Prop() shopType?: string;

  // Custom admin-defined ShopType reference (matched by slug), e.g. 'kaskroteji'.
  // Distinct from the structural `shopType` vertical ('restaurant' | 'grocery').
  @Prop() shopCategory?: string;

  @Prop({ type: [String], default: [] }) cuisines?: string[];

  @Prop({ type: [String], default: [] }) sections?: string[];

  @Prop({ type: [String], default: [] }) keywords?: string[];

  @Prop({ type: [String], default: [] }) tags?: string[];

  @Prop({ type: BussinessDetails }) bussinessDetails?: BussinessDetails;

  @Prop({ default: 0 }) currentWalletAmount?: number;
  @Prop({ default: 0 }) currentWalletAmountMinor?: number;

  @Prop({ default: 0 }) totalWalletAmount?: number;
  @Prop({ default: 0 }) totalWalletAmountMinor?: number;

  @Prop({ default: 0 }) withdrawnWalletAmount?: number;
  @Prop({ default: 0 }) withdrawnWalletAmountMinor?: number;

  @Prop() walletAmountCurrency?: string;

  @Prop() walletAmountScale?: number;

  @Prop({ default: 0 }) rating?: number;

  @Prop() boundType?: string;

  @Prop({ default: true }) isOrderNotification?: boolean;

  @Prop({ default: true }) isOfferNotification?: boolean;

  @Prop({ type: { delivery: Boolean, pickup: Boolean } })
  deliveryOptions?: { delivery?: boolean; pickup?: boolean };
}

export const RestaurantSchema = SchemaFactory.createForClass(Restaurant);
RestaurantSchema.index({ location: '2dsphere' });
RestaurantSchema.index({ deliveryBounds: '2dsphere' }, { sparse: true });

// Matches OperationsService.getZoneOperationalStats' open-store-count
// aggregate (`{isActive:true, isAvailable:true, zone:{$ne:null}}` grouped by
// zone) — the Fleet & Dispatch Operations Center's per-zone stats/hotspots
// queries. `zone` had no index at all before this, mirroring the same gap
// already fixed on Rider (`{zone:1, isActive:1}`) for the same reason.
RestaurantSchema.index({ zone: 1, isActive: 1, isAvailable: 1 });
