import { PUB_SUB, PubSubModule, AppPubSub } from '../pubsub/pubsub.module';
import { Events } from './events';

// Regression test for the "store/rider don't get notified quickly" incident:
// PUB_SUB used to be backed by graphql-redis-subscriptions, and when the
// Redis host became unreachable, publish() silently swallowed the error
// (see pubsub.module.ts history) — no exception, but no delivery either.
// PUB_SUB is now an in-process PubSub with no external dependency, so
// publish -> subscriber delivery must complete near-instantly with nothing
// in between that could reintroduce a network hop or queue.
describe('Order notification latency (store + rider dispatch)', () => {
  const buildPubSub = (): AppPubSub => {
    const provider = Reflect.getMetadata('providers', PubSubModule).find(
      (candidate: { provide?: string }) => candidate.provide === PUB_SUB,
    );
    return provider.useFactory();
  };

  // Mirrors the `filter` used by subscribePlaceOrder in subscriptions.resolver.ts
  const isForRestaurant = (payload: any, restaurantId: string) =>
    payload[Events.ORDER_PLACED]?.restaurantId === restaurantId;

  // Mirrors the `filter` used by subscriptionZoneOrders in subscriptions.resolver.ts
  const isForZone = (payload: any, zoneId: string) =>
    !!payload[Events.ORDER_PLACED]?.zoneId && payload[Events.ORDER_PLACED]?.zoneId === zoneId;

  const MAX_ACCEPTABLE_LATENCY_MS = 100;

  it('delivers a new order to the store subscription (subscribePlaceOrder) within 100ms', async () => {
    const pubSub = buildPubSub();
    const restaurantId = 'restaurant-123';
    const iterator = pubSub.asyncIterableIterator<any>(Events.ORDER_PLACED);

    const received = (async () => {
      for await (const payload of iterator as any) {
        if (isForRestaurant(payload, restaurantId)) return payload;
      }
    })();

    const start = Date.now();
    await pubSub.publish(Events.ORDER_PLACED, {
      [Events.ORDER_PLACED]: {
        origin: 'new',
        restaurantId,
        zoneId: 'zone-1',
        order: { _id: 'order-1', orderStatus: 'PENDING' },
      },
    });

    const payload = await received;
    const elapsed = Date.now() - start;

    expect(payload[Events.ORDER_PLACED].order._id).toBe('order-1');
    expect(elapsed).toBeLessThan(MAX_ACCEPTABLE_LATENCY_MS);
  });

  it('delivers a prepared order to the rider zone subscription (subscriptionZoneOrders) within 100ms', async () => {
    const pubSub = buildPubSub();
    const zoneId = 'zone-sfax';
    const iterator = pubSub.asyncIterableIterator<any>(Events.ORDER_PLACED);

    const received = (async () => {
      for await (const payload of iterator as any) {
        if (isForZone(payload, zoneId)) return payload;
      }
    })();

    const start = Date.now();
    await pubSub.publish(Events.ORDER_PLACED, {
      [Events.ORDER_PLACED]: {
        origin: 'new',
        restaurantId: 'restaurant-456',
        zoneId,
        order: { _id: 'order-2', orderStatus: 'PREPARED' },
      },
    });

    const payload = await received;
    const elapsed = Date.now() - start;

    expect(payload[Events.ORDER_PLACED].order._id).toBe('order-2');
    expect(elapsed).toBeLessThan(MAX_ACCEPTABLE_LATENCY_MS);
  });

  it('delivers a rider-assignment call (subscriptionAssignRider) within 100ms', async () => {
    const pubSub = buildPubSub();
    const riderId = 'rider-789';
    const iterator = pubSub.asyncIterableIterator<any>(Events.RIDER_ASSIGNED);

    const received = (async () => {
      for await (const payload of iterator as any) {
        if (payload[Events.RIDER_ASSIGNED]?.riderId === riderId) return payload;
      }
    })();

    const start = Date.now();
    await pubSub.publish(Events.RIDER_ASSIGNED, {
      [Events.RIDER_ASSIGNED]: {
        riderId,
        origin: 'call',
        order: { _id: 'order-3', orderStatus: 'PREPARED' },
      },
    });

    const payload = await received;
    const elapsed = Date.now() - start;

    expect(payload[Events.RIDER_ASSIGNED].order._id).toBe('order-3');
    expect(elapsed).toBeLessThan(MAX_ACCEPTABLE_LATENCY_MS);
  });

  it('does not deliver to a subscriber filtering on a different restaurant/zone', async () => {
    const pubSub = buildPubSub();
    const iterator = pubSub.asyncIterableIterator<any>(Events.ORDER_PLACED);
    let sawWrongRestaurant = false;

    const consumer = (async () => {
      for await (const payload of iterator as any) {
        if (isForRestaurant(payload, 'restaurant-999')) {
          sawWrongRestaurant = true;
        }
        break; // only the first published event matters for this assertion
      }
    })();

    await pubSub.publish(Events.ORDER_PLACED, {
      [Events.ORDER_PLACED]: {
        origin: 'new',
        restaurantId: 'restaurant-123',
        order: { _id: 'order-4' },
      },
    });
    await consumer;

    expect(sawWrongRestaurant).toBe(false);
  });
});
