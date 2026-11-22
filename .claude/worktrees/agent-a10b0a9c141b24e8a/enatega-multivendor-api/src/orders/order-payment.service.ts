import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Order, OrderDocument } from './order.schema';
import { OrdersService } from './orders.service';
import {
  AttachPaymentSessionInput,
  ConfirmOrderPaidInput,
  OrderPaymentContext,
  OrderPaymentPort,
} from './order-payment.port';

@Injectable()
export class OrderPaymentService implements OrderPaymentPort {
  constructor(
    @InjectModel(Order.name) private readonly orderModel: Model<OrderDocument>,
    private readonly ordersService: OrdersService,
  ) {}

  async getPaymentContext(orderId: string): Promise<OrderPaymentContext> {
    const order = await this.orderModel
      .findById(orderId)
      .select(
        '_id orderId orderAmount orderAmountMinor orderAmountCurrency orderAmountScale paymentStatus paymentReference',
      )
      .lean()
      .exec();
    if (!order) throw new NotFoundException('Order not found');

    const doc = order as any;
    return {
      orderId: String(doc._id ?? orderId),
      orderRef: doc.orderId,
      orderAmount: Number(doc.orderAmount ?? 0),
      orderAmountMinor: doc.orderAmountMinor,
      orderAmountCurrency: doc.orderAmountCurrency,
      orderAmountScale: doc.orderAmountScale,
      paymentStatus: doc.paymentStatus,
      paymentReference: doc.paymentReference,
    };
  }

  async attachPaymentSession(
    orderId: string,
    session: AttachPaymentSessionInput,
  ): Promise<void> {
    const result = await this.orderModel
      .updateOne(
        { _id: orderId },
        {
          $set: {
            paymentProvider: session.provider,
            paymentReference: session.reference,
            paymentLink: session.link,
          },
        },
      )
      .exec();

    if ((result as any).matchedCount === 0) throw new NotFoundException('Order not found');
  }

  async confirmPaid(input: ConfirmOrderPaidInput): Promise<void> {
    await this.ordersService.markOrderPaid(input.orderId, {
      paidAmount: input.paidAmount,
      paidAmountMinor: input.paidAmountMinor,
      reference: input.reference,
      provider: input.provider,
    });
  }
}
