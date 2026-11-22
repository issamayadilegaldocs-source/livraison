import { PUB_SUB, REDIS_CLIENT, PubSubModule } from './pubsub.module';

jest.mock('ioredis', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({ on: jest.fn() })),
}));
// eslint-disable-next-line @typescript-eslint/no-var-requires
const Redis = require('ioredis').default;

describe('PubSubModule', () => {
  // Regression (found via the cross-app E2E suite): with ioredis's 10s default
  // connectTimeout and no commandTimeout, a Redis outage made best-effort,
  // "never blocks" tracking/dispatch cleanup calls (revokeOrder,
  // terminateOrderTracking, writePresence) stall customer-facing mutations
  // like assignOrder for 10-20+ seconds before giving up. Every call site
  // already treats Redis as optional (try/catch + Mongo fallback) — this only
  // asserts the client itself is configured to fail fast so that contract
  // actually holds under a real outage.
  it('configures the Redis client to fail fast (bounded connect/command timeouts) so an outage cannot stall a mutation for 10+ seconds', () => {
    const config = { get: jest.fn((_key: string, fallback?: unknown) => fallback) };
    const provider = Reflect.getMetadata('providers', PubSubModule).find(
      (candidate: { provide?: string }) => candidate.provide === REDIS_CLIENT,
    );

    provider.useFactory(config as never);

    expect(Redis).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        connectTimeout: expect.any(Number),
        commandTimeout: expect.any(Number),
        maxRetriesPerRequest: expect.any(Number),
      }),
    );
    const [, options] = Redis.mock.calls[0];
    expect(options.connectTimeout).toBeLessThanOrEqual(5000);
    expect(options.commandTimeout).toBeLessThanOrEqual(5000);
  });

  it('provides an in-process PubSub that supports publish and subscribe', async () => {
    const provider = Reflect.getMetadata('providers', PubSubModule).find(
      (candidate: { provide?: string }) => candidate.provide === PUB_SUB,
    );

    const pubSub = provider.useFactory();
    const iterator = pubSub.asyncIterableIterator('TEST_EVENT');

    const next = iterator.next();
    await pubSub.publish('TEST_EVENT', { hello: 'world' });

    await expect(next).resolves.toEqual({
      value: { hello: 'world' },
      done: false,
    });
  });
});
