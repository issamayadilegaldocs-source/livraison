import { NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';
import { OrderPaymentService } from './order-payment.service';
import { OrdersService } from './orders.service';

const query = (resolved: unknown) => {
  const q: any = {};
  q.select = jest.fn().mockReturnValue(q);
  q.populate = jest.fn().mockReturnValue(q);
  q.lean = jest.fn().mockReturnValue(q);
  q.exec = jest.fn().mockResolvedValue(resolved);
  return q;
};

describe('OrderPaymentService', () => {
  it('persists hosted payment session details on the order', async () => {
    const exec = jest.fn().mockResolvedValue({ matchedCount: 1 });
    const orderModel = {
      updateOne: jest.fn().mockReturnValue({ exec }),
    };
    const service = new OrderPaymentService(orderModel as never, {} as never);

    await service.attachPaymentSession('order_1', {
      provider: 'FLOUCI',
      reference: 'pay_123',
      link: 'https://pay.example/session',
    });

    expect(orderModel.updateOne).toHaveBeenCalledWith(
      { _id: 'order_1' },
      {
        $set: {
          paymentProvider: 'FLOUCI',
          paymentReference: 'pay_123',
          paymentLink: 'https://pay.example/session',
        },
      },
    );
  });

  it('throws NotFoundException when attaching a session to a missing order', async () => {
    const exec = jest.fn().mockResolvedValue({ matchedCount: 0 });
    const orderModel = {
      updateOne: jest.fn().mockReturnValue({ exec }),
    };
    const service = new OrderPaymentService(orderModel as never, {} as never);

    await expect(
      service.attachPaymentSession('missing_order', {
        provider: 'FLOUCI',
        reference: 'pay_123',
        link: 'https://pay.example/session',
      }),
    ).rejects.toThrow(new NotFoundException('Order not found'));
  });

  it('returns a plain payment context DTO', async () => {
    const orderModel = {
      findById: jest.fn().mockReturnValue(
        query({
          _id: new Types.ObjectId('65a4d4b5e95f1a07a5a3d111'),
          orderId: 'ORD-001',
          orderAmount: 42.5,
          orderAmountMinor: 42500,
          orderAmountCurrency: 'TND',
          orderAmountScale: 3,
          paymentStatus: 'UNPAID',
          paymentReference: 'pay_123',
        }),
      ),
    };
    const service = new OrderPaymentService(orderModel as never, {} as never);

    await expect(service.getPaymentContext('65a4d4b5e95f1a07a5a3d111')).resolves.toEqual({
      orderId: '65a4d4b5e95f1a07a5a3d111',
      orderRef: 'ORD-001',
      orderAmount: 42.5,
      orderAmountMinor: 42500,
      orderAmountCurrency: 'TND',
      orderAmountScale: 3,
      paymentStatus: 'UNPAID',
      paymentReference: 'pay_123',
    });
  });

  it('keeps paid confirmation idempotent and publishes ORDER_PLACED once', async () => {
    const orderId = new Types.ObjectId('65a4d4b5e95f1a07a5a3d222');
    const orderDoc: any = {
      _id: orderId,
      orderAmount: 30,
      paymentStatus: 'UNPAID',
      orderAmountMinor: 30000,
      orderAmountCurrency: 'TND',
      orderAmountScale: 3,
      save: jest.fn().mockResolvedValue(undefined),
    };
    const populatedOrder = {
      _id: orderId,
      user: { clerkId: 'user_1' },
      restaurant: { _id: new Types.ObjectId('65a4d4b5e95f1a07a5a3d333') },
      zone: { _id: new Types.ObjectId('65a4d4b5e95f1a07a5a3d444') },
    };
    let findByIdCall = 0;
    const orderModel = {
      findById: jest.fn(() => {
        findByIdCall += 1;
        return query(findByIdCall % 2 === 1 ? orderDoc : populatedOrder);
      }),
    };
    const pubSub = { publish: jest.fn().mockResolvedValue(undefined) };
    const ordersService = new OrdersService(
      orderModel as never,
      {} as never,
      {} as never,
      {} as never,
      pubSub as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      { get: () => 'UTC' } as never,
      {} as never,
    );
    const service = new OrderPaymentService(orderModel as never, ordersService);

    await service.confirmPaid({
      orderId: String(orderId),
      provider: 'FLOUCI',
      reference: 'pay_123',
      paidAmount: 30,
      paidAmountMinor: 30000,
    });
    await service.confirmPaid({
      orderId: String(orderId),
      provider: 'FLOUCI',
      reference: 'pay_123',
      paidAmount: 30,
      paidAmountMinor: 30000,
    });

    expect(orderDoc.paymentStatus).toBe('PAID');
    expect(orderDoc.paidAmountMinor).toBe(30000);
    expect(orderDoc.paymentReference).toBe('pay_123');
    expect(orderDoc.paymentProvider).toBe('FLOUCI');
    expect(pubSub.publish).toHaveBeenCalledTimes(1);
  });
});
