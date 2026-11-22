import { Global, Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PubSub } from 'graphql-subscriptions';
import Redis from 'ioredis';

export const PUB_SUB = 'PUB_SUB';
export const REDIS_CLIENT = 'REDIS_CLIENT';

export interface AppPubSub {
  publish(triggerName: string, payload: unknown): Promise<void>;
  asyncIterableIterator<T>(triggers: string | string[]): AsyncIterableIterator<T>;
}

@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const logger = new Logger('Redis');
        const url = config.get<string>('REDIS_URL', 'redis://127.0.0.1:6379');
        const password = config.get<string>('REDIS_PASSWORD');
        const username = config.get<string>('REDIS_USERNAME');
        // Managed Redis requires TLS + auth (§4/§6). `rediss://` enables TLS in
        // ioredis automatically; REDIS_TLS=true forces it for providers that
        // front TLS on a `redis://` URL. Credentials may live in the URL or be
        // supplied separately so secrets stay out of the connection string.
        const tlsForced = config.get<string>('REDIS_TLS') === 'true';
        const client = new Redis(url, {
          lazyConnect: true,
          enableReadyCheck: true,
          maxRetriesPerRequest: 1,
          // Every caller of this client (tracking presence, order-transition
          // cleanup, dispatch fallback) treats Redis as best-effort with a
          // Mongo/no-op fallback and wraps calls in try/catch — but with
          // ioredis's 10s default connectTimeout, a Redis outage still made
          // customer-facing mutations (e.g. assignOrder → terminateOrderTracking
          // → revokeOrder) hang for 10-20+ seconds before giving up, which is
          // not "never blocks" in any way a user would recognize. Bound both the
          // connection attempt and each command so an outage costs at most ~2s,
          // not tens of seconds, discovered via the cross-app E2E suite.
          connectTimeout: 3000,
          commandTimeout: 2000,
          ...(password ? { password } : {}),
          ...(username ? { username } : {}),
          ...(tlsForced || url.startsWith('rediss://') ? { tls: {} } : {}),
        });
        client.on('error', () => logger.warn('Redis connection unavailable'));
        return client;
      },
    },
    {
      // In-process PubSub for GraphQL subscriptions (order events, rider
      // assignment calls). Unlike rider geo-presence (see REDIS_CLIENT above,
      // consumed by TrackingService), subscriptions have no Mongo fallback —
      // if Redis pub/sub is unreachable, events are just dropped. Since the
      // API currently runs as a single instance, an in-memory PubSub removes
      // that external dependency entirely. Revisit only if the API is ever
      // horizontally scaled to multiple instances, where cross-instance
      // delivery would require a shared broker again.
      provide: PUB_SUB,
      useFactory: (): AppPubSub => {
        const pubSub = new PubSub();
        return {
          publish: (triggerName: string, payload: unknown) =>
            pubSub.publish(triggerName, payload),
          asyncIterableIterator: <T>(triggers: string | string[]) =>
            pubSub.asyncIterableIterator<T>(triggers),
        };
      },
    },
  ],
  exports: [PUB_SUB, REDIS_CLIENT],
})
export class PubSubModule {}
