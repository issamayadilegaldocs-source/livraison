import { DeliveryEstimationService } from './delivery-estimation.service';

const query = (value: unknown) => ({ lean: () => ({ exec: () => Promise.resolve(value) }) });

describe('DeliveryEstimationService', () => {
  const restaurant = { deliveryTime: 20, location: { coordinates: [13.405, 52.52] } };

  function createService(mode = 'dynamic', travelResult: number | null = 12) {
    const restaurantModel = { findById: jest.fn(() => query(restaurant)) };
    const configurationModel = { findOne: jest.fn(() => query({ deliveryTimeEstimationMode: mode })) };
    const provider = { travelMinutes: jest.fn().mockResolvedValue(travelResult) };
    return {
      service: new DeliveryEstimationService(restaurantModel as never, configurationModel as never, provider as never),
      provider,
    };
  }

  it('uses the static preparation time without calling routes in static mode', async () => {
    const { service, provider } = createService('static');
    await expect(service.estimate({ restaurantId: 'id', latitude: 52.4, longitude: 13.3, isPickedUp: false }))
      .resolves.toEqual({ totalMinutes: 20, travelMinutes: 0, prepMinutes: 20, source: 'static' });
    expect(provider.travelMinutes).not.toHaveBeenCalled();
  });

  it('adds successful travel time to preparation time in dynamic mode', async () => {
    const { service } = createService();
    await expect(service.estimate({ restaurantId: 'id', latitude: 52.4, longitude: 13.3, isPickedUp: false }))
      .resolves.toEqual({ totalMinutes: 32, travelMinutes: 12, prepMinutes: 20, source: 'dynamic' });
  });

  it('does not add travel time for pickup', async () => {
    const { service, provider } = createService();
    const result = await service.estimate({ restaurantId: 'id', latitude: 52.4, longitude: 13.3, isPickedUp: true });
    expect(result.totalMinutes).toBe(20);
    expect(provider.travelMinutes).not.toHaveBeenCalled();
  });

  it('coalesces concurrent misses and caches only successful travel durations', async () => {
    const { service, provider } = createService();
    const input = { restaurantId: 'id', latitude: 52.4, longitude: 13.3, isPickedUp: false };
    await Promise.all([service.estimate(input), service.estimate(input)]);
    await service.estimate(input);
    expect(provider.travelMinutes).toHaveBeenCalledTimes(1);

    const failed = createService('dynamic', null);
    await failed.service.estimate(input);
    await failed.service.estimate(input);
    expect(failed.provider.travelMinutes).toHaveBeenCalledTimes(2);
  });

  it('never calls the provider in cache-only mode and falls back to static on a miss', async () => {
    const { service, provider } = createService();
    const input = { restaurantId: 'id', latitude: 52.4, longitude: 13.3, isPickedUp: false };
    await expect(service.estimate(input, { useProvider: false }))
      .resolves.toEqual({ totalMinutes: 20, travelMinutes: 0, prepMinutes: 20, source: 'static' });
    expect(provider.travelMinutes).not.toHaveBeenCalled();
  });

  it('serves the warmed cache in cache-only mode without a new provider call', async () => {
    const { service, provider } = createService();
    const input = { restaurantId: 'id', latitude: 52.4, longitude: 13.3, isPickedUp: false };
    await service.estimate(input); // warm cache via a normal (provider) request
    expect(provider.travelMinutes).toHaveBeenCalledTimes(1);
    await expect(service.estimate(input, { useProvider: false }))
      .resolves.toEqual({ totalMinutes: 32, travelMinutes: 12, prepMinutes: 20, source: 'dynamic' });
    expect(provider.travelMinutes).toHaveBeenCalledTimes(1); // no extra call
  });

  it('normalizes negative preparation time and falls back when routes fails', async () => {
    const restaurantModel = { findById: jest.fn(() => query({ ...restaurant, deliveryTime: -4 })) };
    const configurationModel = { findOne: jest.fn(() => query({ deliveryTimeEstimationMode: 'dynamic' })) };
    const provider = { travelMinutes: jest.fn().mockRejectedValue(new Error('timeout')) };
    const service = new DeliveryEstimationService(restaurantModel as never, configurationModel as never, provider as never);
    await expect(service.estimate({ restaurantId: 'id', latitude: 52.4, longitude: 13.3, isPickedUp: false }))
      .resolves.toEqual({ totalMinutes: 0, travelMinutes: 0, prepMinutes: 0, source: 'static' });
  });
});
