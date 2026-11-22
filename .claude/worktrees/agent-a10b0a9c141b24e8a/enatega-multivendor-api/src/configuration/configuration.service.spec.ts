import { ConfigurationService } from './configuration.service';

const query = (resolved: unknown) => ({
  exec: jest.fn().mockResolvedValue(resolved),
});

describe('ConfigurationService money metadata', () => {
  it('returns configured global currency', async () => {
    const service = new ConfigurationService({} as never);
    jest.spyOn(service, 'get').mockResolvedValue({ currency: 'EUR' } as never);

    await expect(service.getGlobalCurrency()).resolves.toBe('EUR');
  });

  it('falls back to USD when global currency is missing', async () => {
    const service = new ConfigurationService({} as never);
    jest.spyOn(service, 'get').mockResolvedValue({} as never);

    await expect(service.getGlobalCurrency()).resolves.toBe('USD');
  });

  it('dual-writes configured price minor units using the active currency scale', async () => {
    const existing = {
      currency: 'TND',
      currencyDecimalDigits: 3,
    };
    const findOneAndUpdate = jest.fn().mockReturnValue(query({}));
    const model = {
      findOne: jest.fn().mockReturnValue(query(existing)),
      findOneAndUpdate,
      create: jest.fn(),
    };
    const service = new ConfigurationService(model as never);

    await service.update({
      deliveryRate: 1.235,
      baseDeliveryFee: 0.5,
      expressSurcharge: 2.5,
    });

    const [, update] = findOneAndUpdate.mock.calls[0];
    expect(update.$set).toEqual(
      expect.objectContaining({
        deliveryRate: 1.235,
        deliveryRateMinor: 1235,
        baseDeliveryFee: 0.5,
        baseDeliveryFeeMinor: 500,
        expressSurcharge: 2.5,
        expressSurchargeMinor: 2500,
      }),
    );
  });

  it('uses currency changes in the same patch when deriving minor units', async () => {
    const findOneAndUpdate = jest.fn().mockReturnValue(query({}));
    const model = {
      findOne: jest.fn().mockReturnValue(query({ currency: 'USD', currencyDecimalDigits: 2 })),
      findOneAndUpdate,
      create: jest.fn(),
    };
    const service = new ConfigurationService(model as never);

    await service.update({
      currency: 'TND',
      currencyDecimalDigits: 3,
      expressSurcharge: 1.235,
    });

    const [, update] = findOneAndUpdate.mock.calls[0];
    expect(update.$set).toEqual(
      expect.objectContaining({
        currency: 'TND',
        currencyDecimalDigits: 3,
        expressSurcharge: 1.235,
        expressSurchargeMinor: 1235,
      }),
    );
  });
});
