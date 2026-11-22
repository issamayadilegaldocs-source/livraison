import { BadRequestException } from '@nestjs/common';
import { OrderPaymentPort } from '../orders/order-payment.port';
import { PaymentsService } from './payments.service';

describe('PaymentsService order payments', () => {
  const makeService = (overrides: Partial<OrderPaymentPort> = {}) => {
    const paymentAttempts = {
      createPending: jest.fn().mockResolvedValue(undefined),
      recordSucceeded: jest.fn().mockResolvedValue(undefined),
      mark: jest.fn().mockResolvedValue(undefined),
    };
    const orderPayment: OrderPaymentPort = {
      getPaymentContext: jest.fn().mockResolvedValue({
        orderId: 'order_1',
        orderRef: 'ORD-001',
        orderAmount: 25,
        orderAmountMinor: 25000,
        orderAmountCurrency: 'TND',
        orderAmountScale: 3,
        paymentStatus: 'UNPAID',
        paymentReference: 'pay_123',
      }),
      attachPaymentSession: jest.fn().mockResolvedValue(undefined),
      confirmPaid: jest.fn().mockResolvedValue(undefined),
      ...overrides,
    };
    const flouci = {
      generatePayment: jest.fn().mockResolvedValue({
        paymentId: 'pay_new',
        link: 'https://pay.example/session',
        raw: { result: { payment_id: 'pay_new' } },
      }),
      verifyPayment: jest.fn().mockResolvedValue('SUCCESS'),
      verifyPaymentResult: jest.fn().mockResolvedValue({
        status: 'SUCCESS',
        raw: { result: { status: 'SUCCESS' } },
      }),
    };
    const config = {
      get: jest.fn((key: string, fallback?: string) =>
        key === 'PUBLIC_API_URL' ? 'https://api.example/api/' : fallback,
      ),
    };
    const service = new PaymentsService(
      {} as never,
      flouci as never,
      orderPayment,
      paymentAttempts as never,
      {} as never,
      config as never,
    );
    return { service, orderPayment, flouci, paymentAttempts };
  };

  it('rejects initiation for an already-paid order', async () => {
    const { service, flouci, orderPayment } = makeService({
      getPaymentContext: jest.fn().mockResolvedValue({
        orderId: 'order_1',
        orderAmount: 25,
        orderAmountMinor: 25000,
        paymentStatus: 'PAID',
      }),
    });

    await expect(service.initiateOrderPayment('order_1')).rejects.toThrow(
      new BadRequestException('Order is already paid'),
    );
    expect(flouci.generatePayment).not.toHaveBeenCalled();
    expect(orderPayment.attachPaymentSession).not.toHaveBeenCalled();
  });

  it('stores the generated payment session through the order payment port', async () => {
    const { service, orderPayment, flouci, paymentAttempts } = makeService();

    await expect(service.initiateOrderPayment('order_1')).resolves.toEqual({
      paymentId: 'pay_new',
      link: 'https://pay.example/session',
    });

    expect(flouci.generatePayment).toHaveBeenCalledWith({
      amountMillimes: 25000,
      successLink: 'https://api.example/api/payments/flouci/success?orderId=order_1',
      failLink: 'https://api.example/api/payments/flouci/fail?orderId=order_1',
      trackingId: 'ORD-001',
    });
    expect(orderPayment.attachPaymentSession).toHaveBeenCalledWith('order_1', {
      provider: 'FLOUCI',
      reference: 'pay_new',
      link: 'https://pay.example/session',
    });
    expect(paymentAttempts.createPending).toHaveBeenCalledWith(
      expect.objectContaining({
        subjectType: 'ORDER',
        subjectId: 'order_1',
        amountMinor: 25000,
        amountCurrency: 'TND',
        amountScale: 3,
        provider: 'FLOUCI',
        providerReference: 'pay_new',
        idempotencyKey: 'order_1',
        link: 'https://pay.example/session',
        raw: { result: { payment_id: 'pay_new' } },
      }),
    );
  });

  it('rejects initiation when the order has no canonical minor-unit amount', async () => {
    const { service, flouci, orderPayment } = makeService({
      getPaymentContext: jest.fn().mockResolvedValue({
        orderId: 'order_1',
        orderAmount: 25,
        paymentStatus: 'UNPAID',
      }),
    });

    await expect(service.initiateOrderPayment('order_1')).rejects.toThrow(
      new BadRequestException('Order amount is invalid'),
    );
    expect(flouci.generatePayment).not.toHaveBeenCalled();
    expect(orderPayment.attachPaymentSession).not.toHaveBeenCalled();
  });

  it('rejects confirmation when the order has no payment session', async () => {
    const { service, flouci, orderPayment } = makeService({
      getPaymentContext: jest.fn().mockResolvedValue({
        orderId: 'order_1',
        orderAmount: 25,
        orderAmountMinor: 25000,
        paymentStatus: 'UNPAID',
      }),
    });

    await expect(service.confirmOrderPayment('order_1')).rejects.toThrow(
      new BadRequestException('No payment session for this order'),
    );
    expect(flouci.verifyPayment).not.toHaveBeenCalled();
    expect(orderPayment.confirmPaid).not.toHaveBeenCalled();
  });

  it('does not mark the order paid when the provider reports failure', async () => {
    const { service, flouci, orderPayment, paymentAttempts } = makeService();
    flouci.verifyPaymentResult.mockResolvedValue({
      status: 'FAILURE',
      raw: { result: { status: 'FAILURE' } },
    });

    await expect(service.confirmOrderPayment('order_1')).resolves.toEqual({ status: 'FAILURE' });

    expect(flouci.verifyPaymentResult).toHaveBeenCalledWith('pay_123');
    expect(orderPayment.confirmPaid).not.toHaveBeenCalled();
    expect(paymentAttempts.mark).toHaveBeenCalledWith(
      'FLOUCI',
      'pay_123',
      'FAILED',
      { result: { status: 'FAILURE' } },
      {
        errorCode: 'PROVIDER_FAILURE',
        errorMessage: 'Flouci reported payment failure',
      },
    );
  });

  it('marks the attempt processing before provider verification', async () => {
    const { service, paymentAttempts } = makeService();

    await service.confirmOrderPayment('order_1');

    expect(paymentAttempts.mark).toHaveBeenCalledWith('FLOUCI', 'pay_123', 'PROCESSING');
  });

  it('confirms the order paid through the port on provider success', async () => {
    const { service, orderPayment, paymentAttempts } = makeService();

    await expect(service.confirmOrderPayment('order_1')).resolves.toEqual({ status: 'SUCCESS' });

    expect(orderPayment.confirmPaid).toHaveBeenCalledWith({
      orderId: 'order_1',
      provider: 'FLOUCI',
      reference: 'pay_123',
      paidAmount: 25,
      paidAmountMinor: 25000,
    });
    expect(paymentAttempts.mark).toHaveBeenCalledWith(
      'FLOUCI',
      'pay_123',
      'SUCCEEDED',
      { result: { status: 'SUCCESS' } },
    );
  });
});

describe('PaymentsService wallet top-ups', () => {
  const makeService = () => {
    const topUpExec = jest.fn().mockResolvedValue(undefined);
    const topUpModel = {
      create: jest.fn().mockResolvedValue(undefined),
      findOne: jest.fn(),
      updateOne: jest.fn().mockReturnValue({ exec: topUpExec }),
    };
    const paymentAttempts = {
      createPending: jest.fn().mockResolvedValue(undefined),
      recordSucceeded: jest.fn().mockResolvedValue(undefined),
      mark: jest.fn().mockResolvedValue(undefined),
    };
    const flouci = {
      generatePayment: jest.fn().mockResolvedValue({
        paymentId: 'pay_topup',
        link: 'https://pay.example/topup',
        raw: { result: { payment_id: 'pay_topup' } },
      }),
      verifyPayment: jest.fn().mockResolvedValue('SUCCESS'),
      verifyPaymentResult: jest.fn().mockResolvedValue({
        status: 'SUCCESS',
        raw: { result: { status: 'SUCCESS' } },
      }),
    };
    const walletService = {
      credit: jest.fn().mockResolvedValue(1.234),
      creditMinorUnits: jest.fn().mockResolvedValue(1.234),
    };
    const config = {
      get: jest.fn((key: string, fallback?: string) =>
        key === 'PUBLIC_API_URL' ? 'https://api.example/api/' : fallback,
      ),
    };
    const service = new PaymentsService(
      topUpModel as never,
      flouci as never,
      {} as never,
      paymentAttempts as never,
      walletService as never,
      config as never,
    );
    return { service, topUpModel, paymentAttempts, flouci, walletService };
  };

  it('normalizes wallet top-up input to stored minor units before gateway initiation', async () => {
    const { service, topUpModel, paymentAttempts, flouci } = makeService();

    await expect(service.initiateWalletTopUp('user_1', 1.2345)).resolves.toBe(
      'https://pay.example/topup',
    );

    expect(flouci.generatePayment).toHaveBeenCalledWith(
      expect.objectContaining({
        amountMillimes: 1234,
        trackingId: expect.any(String),
      }),
    );
    expect(topUpModel.create).toHaveBeenCalledWith(
      expect.objectContaining({
        paymentId: 'pay_topup',
        userId: 'user_1',
        amount: 1.234,
        amountMinor: 1234,
        amountCurrency: 'TND',
        amountScale: 3,
      }),
    );
    expect(paymentAttempts.createPending).toHaveBeenCalledWith(
      expect.objectContaining({
        subjectType: 'WALLET_TOP_UP',
        amountMinor: 1234,
        amountCurrency: 'TND',
        amountScale: 3,
        provider: 'FLOUCI',
        providerReference: 'pay_topup',
      }),
    );
  });

  it('credits successful wallet top-ups from the stored minor-unit snapshot', async () => {
    const { service, topUpModel, walletService } = makeService();
    topUpModel.findOne.mockReturnValue({
      lean: () => ({
        exec: jest.fn().mockResolvedValue({
          sessionId: 'session_1',
          paymentId: 'pay_topup',
          userId: 'user_1',
          amount: 1.239,
          amountMinor: 1234,
          status: 'PENDING',
        }),
      }),
    });

    await expect(service.confirmWalletTopUp('session_1')).resolves.toEqual({ status: 'SUCCESS' });

    expect(walletService.creditMinorUnits).toHaveBeenCalledWith('user_1', 1234, {
      reason: 'wallet-topup',
    });
    expect(walletService.credit).not.toHaveBeenCalled();
    expect(topUpModel.updateOne).toHaveBeenCalledWith(
      { sessionId: 'session_1' },
      { $set: { status: 'COMPLETED' } },
    );
  });
});
