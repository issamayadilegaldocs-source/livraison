import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ORDER_EARNINGS_PORT, OrderEarningsPort } from '../orders/order-earnings.port';
import { RidersService } from '../riders/riders.service';
import { RestaurantsService } from '../restaurants/restaurants.service';
import { ConfigurationService } from '../configuration/configuration.service';
import { Money, MoneyCurrency } from '../common/money/money';
import { WithdrawRequest, WithdrawRequestDocument } from './withdraw.schema';
import {
  UserTypeEnum,
  OrderTypeEnum,
  RiderEarningsGraphResult,
  StoreEarningsGraphResult,
  EarningsResponse,
  EarningRecord,
  GrandTotalAllEarnings,
} from './models/earnings.model';
import { computeEarningsSplit } from './earnings-split';
import { DateFilterInput, DateRangeInput } from './dto/wallet.inputs';
import { PaginationInput } from '../common/dto/pagination.input';

@Injectable()
export class WalletService {
  constructor(
    @Inject(ORDER_EARNINGS_PORT) private readonly orderEarnings: OrderEarningsPort,
    @InjectModel(WithdrawRequest.name) private readonly withdrawModel: Model<WithdrawRequestDocument>,
    private readonly ridersService: RidersService,
    private readonly restaurantsService: RestaurantsService,
    private readonly configurationService: ConfigurationService,
  ) {}

  /** Global currency code (e.g. "USD"), used to stamp transaction rows. */
  private async getGlobalCurrency(): Promise<string> {
    return this.configurationService.getGlobalCurrency();
  }

  private async getMoneyCurrency(): Promise<Required<MoneyCurrency>> {
    const config = await this.configurationService.get?.();
    return {
      currency: config?.currency ?? 'USD',
      scale: config?.currencyDecimalDigits ?? 2,
    };
  }

  private async toMoney(amount: number): Promise<Money> {
    return Money.fromDecimal(amount, await this.getMoneyCurrency());
  }

  private async resolveRiderMongoId(clerkId: string): Promise<Types.ObjectId> {
    return new Types.ObjectId(await this.ridersService.resolveMongoIdByClerkId(clerkId));
  }

  private async resolveRestaurantMongoId(clerkId: string): Promise<Types.ObjectId> {
    return new Types.ObjectId(await this.restaurantsService.resolveMongoIdByClerkId(clerkId));
  }

  // ── rider earnings ────────────────────────────────────────────────────────

  async riderEarningsGraph(
    riderId: string,
    page = 1,
    limit = 10,
    startDate?: string,
    endDate?: string,
  ): Promise<RiderEarningsGraphResult> {
    const riderMongoId = await this.resolveRiderMongoId(riderId);
    const result = await this.orderEarnings.findRiderEarningsByDate({
      riderId: String(riderMongoId),
      page,
      limit,
      startDate,
      endDate,
    });
    // Rider total per order = delivery commission + 100% of the tip + the
    // platform-funded bonus. `o.riderEarnings` is the commission-only portion
    // (the split's convention; the bonus is surfaced separately).
    const entryTotal = (o: (typeof result.days)[number]['orders'][number]) =>
      (o.riderEarnings ?? 0) + (o.tipping ?? 0) + (o.deliveryBonus ?? 0);
    const earnings = result.days.map(({ date, orders }) => {
      const dayEarningsSum = orders.reduce((s, o) => s + entryTotal(o), 0);
      const dayTipsSum = orders.reduce((s, o) => s + (o.tipping ?? 0), 0);
      return {
        _id: date,
        date,
        earningsArray: orders.map((o) => ({
          date,
          tip: o.tipping ?? 0,
          deliveryFee: o.deliveryCharges,
          commission: o.riderEarnings ?? 0,
          deliveryBonus: o.deliveryBonus ?? 0,
          totalEarnings: entryTotal(o),
          orderDetails: {
            orderId: o.orderId,
            orderType: o.isPickedUp ? 'PICK_UP' : 'DELIVERY',
            paymentMethod: o.paymentMethod,
          },
        })),
        totalDeliveries: orders.length,
        totalEarningsSum: dayEarningsSum,
        totalTipsSum: dayTipsSum,
        totalHours: 0,
      };
    });
    return { totalCount: result.totalCount, earnings };
  }

  async riderGrandTotalEarnings(
    riderId: string,
    orderType?: OrderTypeEnum,
    paymentMethod?: string,
    dateFilter?: DateRangeInput,
  ): Promise<{ earnings: { grandTotalEarnings: { riderTotal: number }; message: string } }> {
    const riderMongoId = await this.resolveRiderMongoId(riderId);
    const riderTotal = await this.orderEarnings.sumRiderEarnings({
      riderId: String(riderMongoId),
      orderType,
      paymentMethod,
      startDate: dateFilter?.startDate,
      endDate: dateFilter?.endDate,
    });
    return { earnings: { grandTotalEarnings: { riderTotal }, message: 'Success' } };
  }

  // ── store earnings ────────────────────────────────────────────────────────

  async storeEarningsGraph(
    storeId: string,
    page = 1,
    limit = 10,
    startDate?: string,
    endDate?: string,
  ): Promise<StoreEarningsGraphResult> {
    const commissionRate = await this.restaurantsService.getCommissionRate(storeId);
    const storeRate = 1 - commissionRate;
    const result = await this.orderEarnings.findStoreEarningsByDate({
      restaurantId: storeId,
      page,
      limit,
      startDate,
      endDate,
    });

    // Store payout is charged on the food commission base (original subtotal),
    // not the grand total — consistent with computeEarningsSplit. `totalOrderAmount`
    // is kept for order-volume display only.
    const earnings = result.days.map((group) => ({
      _id: group.date,
      date: group.date,
      totalEarningsSum: group.totalStoreBase * storeRate,
      totalOrderAmount: group.totalOrderAmount,
      totalDeliveries: group.totalDeliveries,
      earningsArray: group.entries.map((entry) => ({
        date: group.date,
        totalOrderAmount: entry.totalOrderAmount,
        totalEarnings: entry.storeBase * storeRate,
        orderDetails: entry.orderDetails,
      })),
    }));
    return { totalCount: result.totalCount, earnings };
  }

  async storeGrandTotalEarnings(
    storeId: string,
    orderType?: OrderTypeEnum,
    paymentMethod?: string,
    dateFilter?: DateRangeInput,
  ): Promise<{ earnings: { grandTotalEarnings: { storeTotal: number }; message: string } }> {
    const storeMongoId = await this.resolveRestaurantMongoId(storeId);

    const [orders, commissionRate] = await Promise.all([
      this.orderEarnings.findStoreOrders({
        restaurantId: String(storeMongoId),
        orderType,
        paymentMethod,
        startDate: dateFilter?.startDate,
        endDate: dateFilter?.endDate,
      }),
      this.restaurantsService.getCommissionRate(String(storeMongoId)),
    ]);

    // Sum the per-order store share from the authoritative split (commission on
    // the original subtotal) so this grand total agrees with the admin earnings
    // and the store graph, instead of the old grand-total × rate approximation.
    const storeTotal = orders.reduce(
      (s, o) =>
        s +
        computeEarningsSplit({
          orderAmount: o.orderAmount,
          subtotal: o.subtotal,
          deliveryCharges: o.deliveryCharges,
          tipping: o.tipping,
          taxationAmount: o.taxationAmount,
          expressSurcharge: o.expressSurcharge,
          serviceFee: o.serviceFee,
          riderEarnings: o.riderEarnings,
          commissionRate,
          scale: o.orderAmountScale,
        }).storeEarnings,
      0,
    );
    return { earnings: { grandTotalEarnings: { storeTotal }, message: 'Success' } };
  }

  // ── withdraw ──────────────────────────────────────────────────────────────

  async createWithdrawRequest(riderId: string, requestAmount: number): Promise<{ status: string }> {
    const rider = await this.ridersService.getWalletContext(riderId);
    if (!rider) throw new NotFoundException('Rider not found');

    const existing = await this.withdrawModel.findOne({
      rider: rider.id,
      status: 'PENDING',
    }).lean().exec();
    if (existing) {
      throw new BadRequestException('A withdraw request is already pending');
    }

    const requestMoney = await this.toMoney(requestAmount);
    const available =
      rider.currentWalletAmountMinor !== undefined
        ? Money.ofMinor(rider.currentWalletAmountMinor, requestMoney)
        : Money.fromDecimal(rider.currentWalletAmount, requestMoney);
    if (requestAmount < 10) {
      throw new BadRequestException('Minimum withdrawal amount is $10');
    }
    if (requestMoney.compare(available) > 0) {
      throw new BadRequestException(
        `Insufficient wallet balance. Available: ${available.toNumber()}`,
      );
    }

    await this.withdrawModel.create({
      rider: rider.id,
      requestAmount: requestMoney.toNumber(),
      requestAmountMinor: requestMoney.toSafeMinorNumber(),
      requestAmountCurrency: requestMoney.currency,
      requestAmountScale: requestMoney.scale,
      status: 'PENDING',
    });
    return { status: 'PENDING' };
  }

  async createWithdrawRequestStore(storeId: string, requestAmount: number): Promise<{ status: string }> {
    const restaurant = await this.restaurantsService.getWalletContext(storeId);
    if (!restaurant) throw new NotFoundException('Restaurant not found');

    const existing = await this.withdrawModel.findOne({
      restaurant: restaurant.id,
      status: 'PENDING',
    }).lean().exec();
    if (existing) {
      throw new BadRequestException('A withdraw request is already pending');
    }

    const requestMoney = await this.toMoney(requestAmount);
    const available =
      restaurant.currentWalletAmountMinor !== undefined
        ? Money.ofMinor(restaurant.currentWalletAmountMinor, requestMoney)
        : Money.fromDecimal(restaurant.currentWalletAmount, requestMoney);
    if (requestAmount <= 0 || requestMoney.compare(available) > 0) {
      throw new BadRequestException(
        `Insufficient wallet balance. Available: ${available.toNumber()}`,
      );
    }

    await this.withdrawModel.create({
      restaurant: restaurant.id,
      requestAmount: requestMoney.toNumber(),
      requestAmountMinor: requestMoney.toSafeMinorNumber(),
      requestAmountCurrency: requestMoney.currency,
      requestAmountScale: requestMoney.scale,
      status: 'PENDING',
    });
    return { status: 'PENDING' };
  }

  async riderCurrentWithdrawRequest(riderId: string): Promise<WithdrawRequestDocument | null> {
    const rider = await this.ridersService.getWalletContext(riderId);
    if (!rider) return null;
    return this.withdrawModel
      .findOne({ rider: rider.id, status: 'PENDING' })
      .sort({ createdAt: -1 })
      .lean()
      .exec() as Promise<WithdrawRequestDocument | null>;
  }

  async storeCurrentWithdrawRequest(storeId: string): Promise<WithdrawRequestDocument | null> {
    const restaurant = await this.restaurantsService.getWalletContext(storeId);
    if (!restaurant) return null;
    return this.withdrawModel
      .findOne({ restaurant: restaurant.id, status: 'PENDING' })
      .sort({ createdAt: -1 })
      .lean()
      .exec() as Promise<WithdrawRequestDocument | null>;
  }

  async storeTransactionHistory(storeId: string): Promise<{ data: { status: string; amountTransferred: number; createdAt: string }[] }> {
    const restaurant = await this.restaurantsService.getWalletContext(storeId);
    if (!restaurant) return { data: [] };
    const requests = await this.withdrawModel
      .find({ restaurant: restaurant.id })
      .sort({ createdAt: -1 })
      .lean()
      .exec();
    return {
      data: requests.map((r: any) => ({
        status: r.status,
        amountTransferred: r.approvedAmount ?? r.requestAmount,
        createdAt: r.createdAt?.toISOString?.() ?? r.createdAt ?? '',
      })),
    };
  }

  async approveWithdrawRequest(withdrawId: string, approvedAmount: number): Promise<any> {
    const approvedMoney = await this.toMoney(approvedAmount);
    // The `status: 'PENDING'` filter makes this transition atomic and idempotent:
    // a second concurrent/duplicate approve finds no PENDING doc and is rejected,
    // so the wallet is debited exactly once.
    const updated = await this.withdrawModel.findOneAndUpdate(
      { _id: withdrawId, status: 'PENDING' },
      {
        status: 'APPROVED',
        approvedAmount: approvedMoney.toNumber(),
        approvedAmountMinor: approvedMoney.toSafeMinorNumber(),
        requestAmountCurrency: approvedMoney.currency,
        requestAmountScale: approvedMoney.scale,
      },
      { new: true },
    ).lean().exec();
    if (!updated) throw new BadRequestException('Request is not in PENDING state');

    if ((updated as any).rider) {
      await this.ridersService.debitWalletForWithdrawal(
        String((updated as any).rider),
        approvedMoney.toNumber(),
        approvedMoney.toSafeMinorNumber(),
        approvedMoney,
      );
    }
    if ((updated as any).restaurant) {
      await this.restaurantsService.debitWalletForWithdrawal(
        String((updated as any).restaurant),
        approvedMoney.toNumber(),
        approvedMoney.toSafeMinorNumber(),
        approvedMoney,
      );
    }

    // Return populated references so the admin UI receives rider/store objects
    // (name, bank details, …) instead of bare ObjectIds.
    const withdraw = await this.withdrawModel
      .findById(withdrawId)
      .populate('rider', '_id name email phone username available isActive accountNumber currentWalletAmount totalWalletAmount withdrawnWalletAmount createdAt updatedAt bussinessDetails')
      .populate('restaurant', '_id unique_restaurant_id image logo address username slug stripeDetailsSubmitted commissionRate bussinessDetails')
      .lean()
      .exec();
    return { ...(withdraw as any), store: (withdraw as any)?.restaurant };
  }

  async rejectWithdrawRequest(withdrawId: string, reason: string): Promise<any> {
    const withdraw = await this.withdrawModel.findByIdAndUpdate(
      withdrawId,
      { status: 'REJECTED', reason },
      { new: true },
    ).lean().exec();
    if (!withdraw) throw new NotFoundException('Withdraw request not found');
    return withdraw;
  }

  async updateWithdrawReqStatus(id: string, status: string): Promise<{ success: boolean; message?: string; data?: any }> {
    // Fetch the current request before updating to get requestAmount and current status
    const existing = await this.withdrawModel.findById(id).lean().exec();
    if (!existing) return { success: false, message: 'Withdraw request not found' };

    const prevStatus = (existing as any).status as string;
    // Statuses that mean "money has been paid out to the rider"
    const PAID_STATUSES = ['APPROVED', 'TRANSFERRED'];
    const wasPaid = PAID_STATUSES.includes(prevStatus);
    const isNowPaid = PAID_STATUSES.includes(status);

    await this.withdrawModel.findByIdAndUpdate(id, { $set: { status } }).lean().exec();

    // Deduct from rider wallet the first time the request reaches a paid status
    if (isNowPaid && !wasPaid && (existing as any).rider) {
      const money = await this.withdrawRequestMoney(existing as any);
      if (money.toSafeMinorNumber() > 0) {
        await this.ridersService.debitWalletForWithdrawal(
          String((existing as any).rider),
          money.toNumber(),
          money.toSafeMinorNumber(),
          money,
        );
      }
    }
    if (isNowPaid && !wasPaid && (existing as any).restaurant) {
      const money = await this.withdrawRequestMoney(existing as any);
      if (money.toSafeMinorNumber() > 0) {
        await this.restaurantsService.debitWalletForWithdrawal(
          String((existing as any).restaurant),
          money.toNumber(),
          money.toSafeMinorNumber(),
          money,
        );
      }
    }

    // If a paid request is cancelled/rejected, refund the rider wallet
    const CANCELLED_STATUSES = ['CANCELLED', 'REJECTED'];
    if (CANCELLED_STATUSES.includes(status) && wasPaid && (existing as any).rider) {
      const money = await this.withdrawRequestMoney(existing as any);
      if (money.toSafeMinorNumber() > 0) {
        await this.ridersService.creditWalletForWithdrawal(
          String((existing as any).rider),
          money.toNumber(),
          money.toSafeMinorNumber(),
          money,
        );
      }
    }
    if (CANCELLED_STATUSES.includes(status) && wasPaid && (existing as any).restaurant) {
      const money = await this.withdrawRequestMoney(existing as any);
      if (money.toSafeMinorNumber() > 0) {
        await this.restaurantsService.creditWalletForWithdrawal(
          String((existing as any).restaurant),
          money.toNumber(),
          money.toSafeMinorNumber(),
          money,
        );
      }
    }

    const withdraw = await this.withdrawModel
      .findById(id)
      .populate('rider', '_id name email phone username available isActive accountNumber currentWalletAmount totalWalletAmount withdrawnWalletAmount createdAt updatedAt bussinessDetails')
      .populate('restaurant', '_id unique_restaurant_id image logo address username password slug stripeDetailsSubmitted commissionRate bussinessDetails')
      .lean()
      .exec();
    if (!withdraw) {
      return { success: false, message: 'Withdraw request not found' };
    }
    const data = { ...withdraw as any, requestTime: (withdraw as any).requestTime ?? (withdraw as any).createdAt, store: (withdraw as any).restaurant };
    return { success: true, data };
  }

  async getWithdrawRequests(params: {
    userType?: string;
    userId?: string;
    pagination: { pageSize: number; pageNo: number };
    search?: string;
  }): Promise<{ success: boolean; message?: string; pagination: { total: number }; data: any[] }> {
    const { userType, userId, pagination, search } = params;
    const { pageSize, pageNo } = pagination;
    const filter: Record<string, unknown> = {};

    if (userId) {
      if (userType === 'RIDER') filter.rider = new Types.ObjectId(userId);
      else if (userType === 'VENDOR') filter.restaurant = new Types.ObjectId(userId);
    }

    // Free-text search across the request identifier and status.
    if (search?.trim()) {
      const rx = { $regex: search.trim(), $options: 'i' };
      filter.$or = [{ requestId: rx }, { status: rx }];
    }

    const total = await this.withdrawModel.countDocuments(filter);
    const docs = await this.withdrawModel
      .find(filter)
      .sort({ createdAt: -1 })
      .skip((pageNo - 1) * pageSize)
      .limit(pageSize)
      .populate('rider', '_id name email phone username available isActive accountNumber currentWalletAmount totalWalletAmount withdrawnWalletAmount createdAt updatedAt bussinessDetails')
      .populate('restaurant', '_id unique_restaurant_id image logo address username password slug stripeDetailsSubmitted commissionRate bussinessDetails')
      .lean()
      .exec();

    const data = (docs as any[]).map((d) => ({
      ...d,
      requestTime: d.requestTime ?? d.createdAt,
      store: d.restaurant,
    }));

    return { success: true, pagination: { total }, data };
  }

  // ── admin earnings ────────────────────────────────────────────────────────

  async getEarning(params: {
    userType?: UserTypeEnum;
    userId?: string;
    orderType?: OrderTypeEnum;
    paymentMethod?: string;
    pagination?: PaginationInput;
    dateFilter?: DateFilterInput;
    search?: string;
  }): Promise<EarningsResponse> {
    const { userType, userId, orderType, paymentMethod, pagination, dateFilter, search } = params;
    const page = pagination?.pageNo ?? pagination?.page ?? 1;
    const rows = pagination?.pageSize ?? 10;
    const result = await this.orderEarnings.findAdminEarnings({
      riderId: userId && userType === UserTypeEnum.RIDER ? userId : undefined,
      restaurantId: userId && userType !== UserTypeEnum.RIDER ? userId : undefined,
      orderType,
      paymentMethod,
      search,
      startDate: dateFilter?.starting_date ?? dateFilter?.startDate,
      endDate: dateFilter?.ending_date ?? dateFilter?.endDate,
      page,
      limit: rows,
    });

    const commissionRateOf = (restaurant?: { commissionRate?: number }): number =>
      Math.max(0, Math.min(1, restaurant?.commissionRate ?? 0.1));

    const splitOf = (o: (typeof result.all)[number]) =>
      computeEarningsSplit({
        orderAmount: o.orderAmount,
        subtotal: o.subtotal,
        deliveryCharges: o.deliveryCharges,
        tipping: o.tipping,
        taxationAmount: o.taxationAmount,
        expressSurcharge: o.expressSurcharge,
        serviceFee: o.serviceFee,
        deliveryBonus: o.deliveryBonus,
        riderEarnings: o.riderEarnings,
        commissionRate: commissionRateOf(o.restaurant),
        scale: o.orderAmountScale,
      });

    const grandTotals: GrandTotalAllEarnings = { platformTotal: 0, riderTotal: 0, storeTotal: 0 };
    for (const o of result.all) {
      const s = splitOf(o);
      grandTotals.platformTotal! += s.platformTotal;
      grandTotals.riderTotal! += s.riderTotal;
      grandTotals.storeTotal! += s.storeEarnings;
    }

    const earnings: EarningRecord[] = result.page.map((o) => {
      const s = splitOf(o);
      return {
        _id: o.id,
        orderId: o.orderId,
        orderType: o.isPickedUp ? 'PICK_UP' : 'DELIVERY',
        paymentMethod: o.paymentMethod,
        createdAt: this.formatDateValue(o.createdAt),
        updatedAt: this.formatDateValue(o.updatedAt),
        platformEarnings: {
          // Marketplace commission is on food only; delivery remainder, tax,
          // express and the service fee pass through to the platform, and the
          // platform funds promo discounts and the rider bonus.
          marketplaceCommission: s.marketplaceCommission,
          deliveryCommission: s.platformDeliveryShare,
          tax: o.taxationAmount,
          serviceFee: o.serviceFee ?? 0,
          // Extra the platform pays the store because commission is charged on the
          // original subtotal rather than the discounted food it collected.
          promoFunding: Math.max(
            0,
            s.storeEarnings - s.netFood * (1 - commissionRateOf(o.restaurant)),
          ),
          deliveryBonus: s.deliveryBonus,
          platformFee: s.marketplaceCommission,
          totalEarnings: s.platformTotal,
        },
        riderEarnings: o.rider
          ? {
              riderId: { _id: o.rider.id, name: o.rider.name, username: o.rider.username },
              // The rider earns their delivery commission plus 100% of the tip
              // plus the platform-funded bonus.
              deliveryFee: s.riderDelivery,
              tip: s.tip,
              deliveryBonus: s.deliveryBonus,
              totalEarnings: s.riderTotal,
            }
          : undefined,
        storeEarnings: o.restaurant
          ? {
              storeId: {
                _id: o.restaurant.id,
                name: o.restaurant.name,
                username: o.restaurant.username,
              },
              orderAmount: o.orderAmount,
              // Store is paid its share of the food only (no delivery/tip/tax).
              totalEarnings: s.storeEarnings,
            }
          : undefined,
        grandTotalEarnings: grandTotals,
      };
    });

    return {
      success: true,
      message: 'Success',
      data: { earnings, grandTotalEarnings: grandTotals, message: 'Success' },
      pagination: { total: result.totalCount },
    };
  }

  // ── transaction history ───────────────────────────────────────────────────

  async getTransactionHistory(params: {
    userType?: UserTypeEnum;
    userId?: string;
    pagination?: PaginationInput;
    dateFilter?: DateFilterInput;
    search?: string;
  }): Promise<{
    success: boolean;
    message?: string;
    data: any[];
    transactions: any[];
    pagination: { total: number };
  }> {
    const { userType, userId, pagination, dateFilter, search } = params;
    const query: Record<string, unknown> = {};

    if (userId) {
      if (userType === UserTypeEnum.RIDER) {
        if (Types.ObjectId.isValid(userId) && String(new Types.ObjectId(userId)) === userId) {
          query.rider = new Types.ObjectId(userId);
        } else {
          // Clerk ID — look up the rider's MongoDB _id
          const rider = await this.ridersService.getWalletContext(userId);
          if (rider) query.rider = new Types.ObjectId(rider.id);
        }
      } else {
        if (Types.ObjectId.isValid(userId)) {
          query.restaurant = new Types.ObjectId(userId);
        }
      }
    }
    if (search) query.status = { $regex: search, $options: 'i' };
    this.applyDateFilter(
      query,
      dateFilter?.starting_date ?? dateFilter?.startDate,
      dateFilter?.ending_date ?? dateFilter?.endDate,
    );

    const page = pagination?.pageNo ?? pagination?.page ?? 1;
    const rows = pagination?.pageSize ?? 10;
    const [withdrawals, total] = await Promise.all([
      this.withdrawModel
        .find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * rows)
        .limit(rows)
        .populate(
          'rider',
          '_id name email phone username image available isActive accountNumber currentWalletAmount totalWalletAmount withdrawnWalletAmount createdAt updatedAt bussinessDetails',
        )
        .populate(
          'restaurant',
          '_id unique_restaurant_id name image logo address username slug phone city postCode rating reviewAverage isActive isAvailable stripeDetailsSubmitted commissionRate bussinessDetails',
        )
        .lean()
        .exec(),
      this.withdrawModel.countDocuments(query).exec(),
    ]);

    const currency = await this.getGlobalCurrency();
    const data = (withdrawals as any[]).map((w) => ({
      _id: String(w._id),
      status: w.status ?? 'PENDING',
      transactionId: w.requestId ?? String(w._id),
      userType: w.rider ? 'RIDER' : 'STORE',
      userId: String(w.rider?._id ?? w.restaurant?._id ?? ''),
      amountTransferred: w.approvedAmount ?? w.requestAmount,
      amountCurrency: currency,
      requestAmount: w.requestAmount,
      createdAt: w.createdAt?.toISOString?.() ?? String(w.createdAt ?? ''),
      toBank: w.rider?.bussinessDetails ?? w.restaurant?.bussinessDetails,
      rider: w.rider,
      store: w.restaurant,
    }));

    return { success: true, data, transactions: data, pagination: { total } };
  }

  // ── helpers ───────────────────────────────────────────────────────────────

  private applyDateFilter(query: Record<string, unknown>, startDate?: string, endDate?: string) {
    if (!startDate && !endDate) return;
    const df: Record<string, unknown> = {};
    if (startDate) df.$gte = new Date(startDate);
    if (endDate) df.$lte = new Date(endDate);
    query.createdAt = df;
  }

  private formatDateValue(value?: Date | string): string {
    if (!value) return '';
    return value instanceof Date ? value.toISOString() : String(value);
  }

  private async withdrawRequestMoney(withdraw: {
    requestAmount?: number;
    requestAmountMinor?: number;
    requestAmountCurrency?: string;
    requestAmountScale?: number;
  }): Promise<Money> {
    const configured = await this.getMoneyCurrency();
    const currencyConfig = {
      currency: withdraw.requestAmountCurrency ?? configured.currency,
      scale: withdraw.requestAmountScale ?? configured.scale,
    };
    if (withdraw.requestAmountMinor !== undefined) {
      return Money.ofMinor(withdraw.requestAmountMinor, currencyConfig);
    }
    return Money.fromDecimal(withdraw.requestAmount ?? 0, currencyConfig);
  }
}
