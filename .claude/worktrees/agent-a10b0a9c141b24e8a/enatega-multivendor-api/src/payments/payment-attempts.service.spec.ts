import { PaymentAttemptsService } from './payment-attempts.service';

describe('PaymentAttemptsService', () => {
  const makeService = () => {
    const exec = jest.fn().mockResolvedValue(undefined);
    const attemptModel = {
      updateOne: jest.fn().mockReturnValue({ exec }),
    };
    return { service: new PaymentAttemptsService(attemptModel as never), attemptModel };
  };

  it('creates pending attempts idempotently by provider reference', async () => {
    const { service, attemptModel } = makeService();

    await service.createPending({
      subjectType: 'ORDER',
      subjectId: 'order_1',
      amountMinor: 25000,
      amountCurrency: 'TND',
      amountScale: 3,
      provider: 'FLOUCI',
      providerReference: 'pay_1',
      idempotencyKey: 'order_1',
      link: 'https://pay.example/session',
      raw: { ok: true },
    });

    expect(attemptModel.updateOne).toHaveBeenCalledWith(
      { provider: 'FLOUCI', providerReference: 'pay_1' },
      expect.objectContaining({
        $setOnInsert: expect.objectContaining({
          subjectType: 'ORDER',
          subjectId: 'order_1',
          amountMinor: 25000,
          amountCurrency: 'TND',
          amountScale: 3,
          provider: 'FLOUCI',
          providerReference: 'pay_1',
          idempotencyKey: 'order_1',
          link: 'https://pay.example/session',
          startedAt: expect.any(Date),
          status: 'PENDING',
          raw: { ok: true },
        }),
      }),
      { upsert: true },
    );
  });

  it('records immediate wallet successes with paid timestamps', async () => {
    const { service, attemptModel } = makeService();

    await service.recordSucceeded({
      subjectType: 'ORDER',
      subjectId: 'order_1',
      amountMinor: 1234,
      amountCurrency: 'TND',
      amountScale: 3,
      provider: 'WALLET',
      providerReference: 'wallet:order_1',
      idempotencyKey: 'order_1',
      raw: { paymentMethod: 'WALLET' },
    });

    expect(attemptModel.updateOne).toHaveBeenCalledWith(
      { provider: 'WALLET', providerReference: 'wallet:order_1' },
      expect.objectContaining({
        $setOnInsert: expect.objectContaining({
          status: 'SUCCEEDED',
          paidAt: expect.any(Date),
          finishedAt: expect.any(Date),
        }),
      }),
      { upsert: true },
    );
  });

  it('marks existing attempts with provider payloads and errors', async () => {
    const { service, attemptModel } = makeService();

    await service.mark('FLOUCI', 'pay_1', 'FAILED', { status: 'FAILURE' }, {
      errorCode: 'PROVIDER_FAILURE',
      errorMessage: 'failed',
    });

    expect(attemptModel.updateOne).toHaveBeenCalledWith(
      { provider: 'FLOUCI', providerReference: 'pay_1' },
      {
        $set: expect.objectContaining({
          status: 'FAILED',
          raw: { status: 'FAILURE' },
          finishedAt: expect.any(Date),
          errorCode: 'PROVIDER_FAILURE',
          errorMessage: 'failed',
        }),
      },
    );
  });
});
