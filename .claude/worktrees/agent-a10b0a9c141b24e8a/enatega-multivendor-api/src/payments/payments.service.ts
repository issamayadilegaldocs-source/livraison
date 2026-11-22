import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ORDER_PAYMENT_PORT, OrderPaymentPort } from '../orders/order-payment.port';
import { CustomerWalletService } from '../customer-wallet/customer-wallet.service';
import { WalletTopUp, WalletTopUpDocument } from '../customer-wallet/wallet-topup.schema';
import { PAYMENT_ATTEMPT_AUDIT_PORT, PaymentAttemptAuditPort } from './payment-attempts.port';
import { Money } from '../common/money/money';
import {
  FlouciGenerateResult,
  FlouciProvider,
  FlouciStatus,
  FlouciVerifyResult,
} from '../providers/flouci.provider';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    @InjectModel(WalletTopUp.name) private readonly topUpModel: Model<WalletTopUpDocument>,
    private readonly flouci: FlouciProvider,
    @Inject(ORDER_PAYMENT_PORT) private readonly orderPayment: OrderPaymentPort,
    @Inject(PAYMENT_ATTEMPT_AUDIT_PORT)
    private readonly paymentAttempts: PaymentAttemptAuditPort,
    private readonly walletService: CustomerWalletService,
    private readonly configService: ConfigService,
  ) {}

  /** Public base URL the gateway redirects back to, including the `/api` prefix. */
  publicApiBase(): string {
    return this.configService
      .get<string>('PUBLIC_API_URL', 'http://localhost:4000/api')
      .replace(/\/$/, '');
  }

  /** Optional web client URL to bounce the browser back to after payment. */
  webReturnUrl(): string | undefined {
    return this.configService.get<string>('PAYMENT_RETURN_URL') || undefined;
  }

  /** Creates a Flouci hosted-checkout session for an order and stores the ref. */
  async initiateOrderPayment(orderId: string): Promise<FlouciGenerateResult> {
    const order = await this.orderPayment.getPaymentContext(orderId);
    if (order.paymentStatus === 'PAID')
      throw new BadRequestException('Order is already paid');

    if (!Number.isSafeInteger(order.orderAmountMinor) || (order.orderAmountMinor ?? 0) <= 0)
      throw new BadRequestException('Order amount is invalid');
    const amountMillimes = order.orderAmountMinor as number;

    const base = this.publicApiBase();
    const successLink = `${base}/payments/flouci/success?orderId=${orderId}`;
    const failLink = `${base}/payments/flouci/fail?orderId=${orderId}`;

    const result = await this.flouci.generatePayment({
      amountMillimes,
      successLink,
      failLink,
      trackingId: order.orderRef ?? orderId,
    });

    await this.orderPayment.attachPaymentSession(orderId, {
      provider: 'FLOUCI',
      reference: result.paymentId,
      link: result.link,
    });
    await this.paymentAttempts.createPending({
      subjectType: 'ORDER',
      subjectId: orderId,
      amountMinor: amountMillimes,
      amountCurrency: order.orderAmountCurrency ?? 'TND',
      amountScale: order.orderAmountScale ?? 3,
      provider: 'FLOUCI',
      providerReference: result.paymentId,
      idempotencyKey: orderId,
      link: result.link,
      raw: result.raw,
    });

    return { link: result.link, paymentId: result.paymentId };
  }

  /** Verifies a Flouci payment and, on success, releases the order as paid. */
  async confirmOrderPayment(orderId: string): Promise<{ status: FlouciStatus }> {
    const order = await this.orderPayment.getPaymentContext(orderId);
    if (order.paymentStatus === 'PAID') return { status: 'SUCCESS' };

    const paymentId = order.paymentReference;
    if (!paymentId) throw new BadRequestException('No payment session for this order');

    await this.paymentAttempts.mark('FLOUCI', paymentId, 'PROCESSING');
    const verification = await this.verifyFlouciPayment(paymentId);
    const status = verification.status;
    if (status === 'SUCCESS') {
      await this.orderPayment.confirmPaid({
        orderId,
        paidAmount: Number(order.orderAmount ?? 0),
        paidAmountMinor: order.orderAmountMinor,
        reference: paymentId,
        provider: 'FLOUCI',
      });
      await this.paymentAttempts.mark('FLOUCI', paymentId, 'SUCCEEDED', verification.raw);
    } else if (status === 'FAILURE') {
      await this.paymentAttempts.mark('FLOUCI', paymentId, 'FAILED', verification.raw, {
        errorCode: 'PROVIDER_FAILURE',
        errorMessage: 'Flouci reported payment failure',
      });
    } else {
      await this.paymentAttempts.mark('FLOUCI', paymentId, 'PENDING', verification.raw);
    }
    return { status };
  }

  /** Creates a Flouci top-up session for the given userId and amount (TND). */
  async initiateWalletTopUp(userId: string, amount: number): Promise<string> {
    const topUpMoney = Money.fromDecimal(amount, { currency: 'TND', scale: 3 });
    const amountMillimes = topUpMoney.toSafeMinorNumber();
    if (amountMillimes <= 0) throw new BadRequestException('Amount must be positive');
    const base = this.publicApiBase();
    const sessionId = randomUUID();
    const result = await this.flouci.generatePayment({
      amountMillimes,
      successLink: `${base}/payments/flouci/topup-success?sessionId=${encodeURIComponent(sessionId)}`,
      failLink: `${base}/payments/flouci/topup-fail?sessionId=${encodeURIComponent(sessionId)}`,
      trackingId: sessionId,
    });
    await this.topUpModel.create({
      sessionId,
      paymentId: result.paymentId,
      userId,
      amount: topUpMoney.toNumber(),
      amountMinor: amountMillimes,
      amountCurrency: topUpMoney.currency,
      amountScale: topUpMoney.scale,
    });
    await this.paymentAttempts.createPending({
      subjectType: 'WALLET_TOP_UP',
      subjectId: sessionId,
      amountMinor: amountMillimes,
      amountCurrency: topUpMoney.currency,
      amountScale: topUpMoney.scale,
      provider: 'FLOUCI',
      providerReference: result.paymentId,
      idempotencyKey: sessionId,
      link: result.link,
      raw: result.raw,
    });
    this.logger.log(`WalletTopUp: sessionId=${sessionId} paymentId=${result.paymentId} userId=${userId} amount=${amount}`);
    return result.link;
  }

  /** Verifies a Flouci top-up payment and credits the wallet on success. */
  async confirmWalletTopUp(sessionId: string): Promise<{ status: FlouciStatus }> {
    const topUp = await this.topUpModel.findOne({ sessionId }).lean().exec();
    if (!topUp) throw new NotFoundException('Top-up session not found');
    if ((topUp as any).status === 'COMPLETED') return { status: 'SUCCESS' };
    const paymentId = (topUp as any).paymentId;
    await this.paymentAttempts.mark('FLOUCI', paymentId, 'PROCESSING');
    const verification = await this.verifyFlouciPayment(paymentId);
    const status = verification.status;
    if (status === 'SUCCESS') {
      const amountMinor = this.topUpAmountMinor(topUp as any);
      await this.walletService.creditMinorUnits((topUp as any).userId, amountMinor, {
        reason: 'wallet-topup',
      });
      await this.topUpModel.updateOne({ sessionId }, { $set: { status: 'COMPLETED' } }).exec();
      await this.paymentAttempts.mark('FLOUCI', paymentId, 'SUCCEEDED', verification.raw);
    } else if (status === 'FAILURE') {
      await this.topUpModel.updateOne({ sessionId }, { $set: { status: 'FAILED' } }).exec();
      await this.paymentAttempts.mark('FLOUCI', paymentId, 'FAILED', verification.raw, {
        errorCode: 'PROVIDER_FAILURE',
        errorMessage: 'Flouci reported top-up failure',
      });
    } else {
      await this.paymentAttempts.mark('FLOUCI', paymentId, 'PENDING', verification.raw);
    }
    return { status };
  }

  private topUpAmountMinor(topUp: { amountMinor?: number; amount?: number }): number {
    if (Number.isSafeInteger(topUp.amountMinor) && (topUp.amountMinor ?? 0) > 0)
      return topUp.amountMinor as number;
    return Money.fromDecimal(topUp.amount ?? 0, { currency: 'TND', scale: 3 }).toSafeMinorNumber();
  }

  private async verifyFlouciPayment(paymentId: string): Promise<FlouciVerifyResult> {
    if (typeof (this.flouci as any).verifyPaymentResult === 'function')
      return (this.flouci as any).verifyPaymentResult(paymentId);
    return { status: await this.flouci.verifyPayment(paymentId) };
  }
}
