import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  CustomerWallet,
  CustomerWalletDocument,
  CustomerWalletTransaction,
  CustomerWalletTransactionDocument,
} from './customer-wallet.schema';
import { Money } from '../common/money/money';
import { MoneyModel, toMoneyModel } from '../common/money/money.model';

type TxnType = 'CREDIT' | 'DEBIT' | 'REFUND';

interface TxnOptions {
  order?: Types.ObjectId | string;
  reason?: string;
  type?: TxnType;
}

const WALLET_SCALE = 3;
const WALLET_MINOR_FACTOR = 10 ** WALLET_SCALE;

@Injectable()
export class CustomerWalletService {
  constructor(
    @InjectModel(CustomerWallet.name)
    private readonly walletModel: Model<CustomerWalletDocument>,
    @InjectModel(CustomerWalletTransaction.name)
    private readonly txnModel: Model<CustomerWalletTransactionDocument>,
  ) {}

  async getBalance(userId: string): Promise<number> {
    const wallet = await this.walletModel.findOne({ userId }).lean().exec();
    return this.balanceFromWallet(wallet as any);
  }

  async getWallet(userId: string): Promise<{
    balance: number;
    currency?: string;
    balanceMoney: MoneyModel | null;
    transactions: Array<Record<string, unknown>>;
  }> {
    const wallet = await this.ensureWallet(userId);
    const currency = wallet.currency ?? 'TND';
    const docs = (await this.txnModel
      .find({ userId })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean()
      .exec()) as any[];
    const transactions = docs.map((t) => ({
      _id: String(t._id),
      type: t.type,
      amount: this.amountFromTransaction(t),
      balanceAfter: this.balanceAfterFromTransaction(t),
      amountMoney: this.moneyFromMinor(this.amountMinorFromTransaction(t), currency),
      balanceAfterMoney: this.moneyFromMinor(t.balanceAfterMinor, currency),
      order: t.order ? String(t.order) : undefined,
      reason: t.reason,
      createdAt: t.createdAt ? new Date(t.createdAt).toISOString() : undefined,
    }));
    return {
      balance: this.balanceFromWallet(wallet as any),
      currency: wallet.currency,
      balanceMoney: this.moneyFromMinor(this.balanceMinorFromWallet(wallet as any), currency),
      transactions,
    };
  }

  /** Builds the GraphQL money read surface from TND millime minor units. */
  private moneyFromMinor(amountMinor: unknown, currency: string): MoneyModel | null {
    if (typeof amountMinor !== 'number' || !Number.isSafeInteger(amountMinor)) return null;
    return toMoneyModel(amountMinor, { currency, scale: WALLET_SCALE });
  }

  private amountMinorFromTransaction(txn: { amountMinor?: number; amount?: number }): number {
    const amountMinor = txn.amountMinor;
    if (typeof amountMinor === 'number' && Number.isSafeInteger(amountMinor)) return amountMinor;
    return this.toLegacyMinorUnits(txn.amount ?? 0);
  }

  /** Credits the wallet and records a transaction. Returns the new balance. */
  async credit(userId: string, amount: number, opts: TxnOptions = {}): Promise<number> {
    const amountMinor = this.toMinorUnits(amount);
    return this.creditMinorUnits(userId, amountMinor, opts);
  }

  /** Credits a wallet from already-canonical TND minor units. */
  async creditMinorUnits(userId: string, amountMinor: number, opts: TxnOptions = {}): Promise<number> {
    this.assertPositiveMinorUnits(amountMinor);
    const updated = await this.walletModel
      .findOneAndUpdate(
        { userId },
        this.balanceUpdatePipeline(userId, amountMinor),
        { new: true, upsert: true },
      )
      .exec();
    const balanceAfterMinor = this.balanceMinorFromWallet(updated as any);
    await this.record(userId, opts.type ?? 'CREDIT', amountMinor, balanceAfterMinor, opts);
    const balanceAfter = this.fromMinorUnits(balanceAfterMinor);
    return balanceAfter;
  }

  /** Debits the wallet atomically, rejecting if funds are insufficient. */
  async debit(userId: string, amount: number, opts: TxnOptions = {}): Promise<number> {
    const amountMinor = this.toMinorUnits(amount);
    const updated = await this.walletModel
      .findOneAndUpdate(
        {
          userId,
          $expr: { $gte: [this.persistedBalanceMinorExpression(), amountMinor] },
        },
        this.balanceUpdatePipeline(userId, -amountMinor),
        { new: true },
      )
      .exec();
    if (!updated) throw new BadRequestException('Insufficient wallet balance');
    const balanceAfterMinor = this.balanceMinorFromWallet(updated as any);
    await this.record(userId, 'DEBIT', amountMinor, balanceAfterMinor, opts);
    const balanceAfter = this.fromMinorUnits(balanceAfterMinor);
    return balanceAfter;
  }

  private async ensureWallet(userId: string): Promise<CustomerWalletDocument> {
    const existing = await this.walletModel.findOne({ userId }).exec();
    if (existing) return existing;
    return this.walletModel.create({ userId, balanceMinor: 0, balance: 0 });
  }

  private toMinorUnits(amount: number): number {
    const money = Money.fromDecimal(amount, { currency: 'TND', scale: WALLET_SCALE });
    const minor = money.toSafeMinorNumber();
    if (minor <= 0)
      throw new BadRequestException('Amount must be a positive number');
    return minor;
  }

  private assertPositiveMinorUnits(amountMinor: number): void {
    if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0)
      throw new BadRequestException('Amount must be a positive number');
  }

  private fromMinorUnits(amountMinor: number): number {
    return amountMinor / WALLET_MINOR_FACTOR;
  }

  private balanceFromWallet(wallet?: { balanceMinor?: number; balance?: number } | null): number {
    if (!wallet) return 0;
    return this.fromMinorUnits(this.balanceMinorFromWallet(wallet));
  }

  private balanceMinorFromWallet(wallet?: { balanceMinor?: number; balance?: number } | null): number {
    if (!wallet) return 0;
    const balanceMinor = wallet.balanceMinor;
    if (typeof balanceMinor === 'number' && Number.isSafeInteger(balanceMinor)) return balanceMinor;
    return this.toLegacyMinorUnits(wallet.balance ?? 0);
  }

  private amountFromTransaction(txn: { amountMinor?: number; amount?: number }): number {
    const amountMinor = txn.amountMinor;
    if (typeof amountMinor === 'number' && Number.isSafeInteger(amountMinor))
      return this.fromMinorUnits(amountMinor);
    return txn.amount ?? 0;
  }

  private balanceAfterFromTransaction(txn: {
    balanceAfterMinor?: number;
    balanceAfter?: number;
  }): number | undefined {
    const balanceAfterMinor = txn.balanceAfterMinor;
    if (typeof balanceAfterMinor === 'number' && Number.isSafeInteger(balanceAfterMinor))
      return this.fromMinorUnits(balanceAfterMinor);
    return txn.balanceAfter;
  }

  private toLegacyMinorUnits(amount: number): number {
    return Math.round(Number(amount ?? 0) * WALLET_MINOR_FACTOR);
  }

  private persistedBalanceMinorExpression(): Record<string, unknown> {
    return {
      $ifNull: [
        '$balanceMinor',
        {
          $round: [{ $multiply: [{ $ifNull: ['$balance', 0] }, WALLET_MINOR_FACTOR] }, 0],
        },
      ],
    };
  }

  private balanceUpdatePipeline(userId: string, deltaMinor: number): Array<Record<string, unknown>> {
    return [
      {
        $set: {
          userId,
          balanceMinor: { $add: [this.persistedBalanceMinorExpression(), deltaMinor] },
        },
      },
      {
        $set: {
          balance: { $divide: ['$balanceMinor', WALLET_MINOR_FACTOR] },
        },
      },
    ];
  }

  private async record(
    userId: string,
    type: TxnType,
    amountMinor: number,
    balanceAfterMinor: number,
    opts: TxnOptions,
  ): Promise<void> {
    await this.txnModel.create({
      userId,
      type,
      amountMinor,
      amount: this.fromMinorUnits(amountMinor),
      balanceAfterMinor,
      balanceAfter: this.fromMinorUnits(balanceAfterMinor),
      order: opts.order ? new Types.ObjectId(opts.order) : undefined,
      reason: opts.reason,
    });
  }
}
