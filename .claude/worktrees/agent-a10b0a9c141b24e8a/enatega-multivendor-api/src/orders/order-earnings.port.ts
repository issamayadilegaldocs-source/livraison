export const ORDER_EARNINGS_PORT = Symbol('ORDER_EARNINGS_PORT');

export type EarningsOrderType = 'DELIVERY' | 'PICK_UP';

export interface OrderEarningsFilter {
  riderId?: string;
  restaurantId?: string;
  orderType?: EarningsOrderType;
  paymentMethod?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface EarningUserRefDto {
  id: string;
  name?: string;
  username?: string;
  commissionRate?: number;
}

export interface DeliveredEarningRow {
  id: string;
  orderId?: string;
  createdAt?: Date | string;
  updatedAt?: Date | string;
  orderAmount: number;
  orderAmountScale?: number;
  subtotal: number;
  deliveryCharges: number;
  taxationAmount: number;
  tipping: number;
  expressSurcharge: number;
  serviceFee: number;
  deliveryBonus: number;
  riderEarnings: number;
  isPickedUp: boolean;
  paymentMethod?: string;
  rider?: EarningUserRefDto;
  restaurant?: EarningUserRefDto;
}

export interface EarningDayBucket {
  date: string;
  orders: DeliveredEarningRow[];
}

export interface StoreEarningEntryDto {
  totalOrderAmount: number;
  /** Commission base for this order (original subtotal, or discounted food for legacy orders). */
  storeBase: number;
  orderDetails: {
    orderId?: string;
    orderType: EarningsOrderType;
    paymentMethod?: string;
  };
}

export interface StoreEarningDayBucket {
  date: string;
  totalOrderAmount: number;
  /** Sum of the per-order commission base across the day (store payout = base × storeRate). */
  totalStoreBase: number;
  totalDeliveries: number;
  entries: StoreEarningEntryDto[];
}

export interface AdminEarningsResult {
  totalCount: number;
  page: DeliveredEarningRow[];
  all: DeliveredEarningRow[];
}

export interface OrderEarningsPort {
  findRiderEarningsByDate(filter: OrderEarningsFilter): Promise<{
    totalCount: number;
    days: EarningDayBucket[];
  }>;
  sumRiderEarnings(filter: OrderEarningsFilter): Promise<number>;
  findStoreEarningsByDate(filter: OrderEarningsFilter): Promise<{
    totalCount: number;
    days: StoreEarningDayBucket[];
  }>;
  findStoreOrders(filter: OrderEarningsFilter): Promise<DeliveredEarningRow[]>;
  findAdminEarnings(filter: OrderEarningsFilter): Promise<AdminEarningsResult>;
}
