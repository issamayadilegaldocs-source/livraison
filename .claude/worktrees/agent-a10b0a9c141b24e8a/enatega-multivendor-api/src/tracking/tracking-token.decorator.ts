import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';

const firstValue = (value: unknown): string | undefined =>
  Array.isArray(value) ? value[0] : (value as string | undefined);

/**
 * Resolve the per-order tracking token from either transport:
 * - HTTP: the `x-tracking-token` request header (rider foreground over Apollo
 *   HTTP and the background expo-task-manager fetch both send this).
 * - WebSocket: graphql-ws sets auth once per connection via `connectionParams`,
 *   so the dedicated rider tracking socket carries the token there. Resolving it
 *   here lets the resolver/service stay identical across both transports.
 */
export const extractTrackingToken = (gqlContext: {
  req?: { headers?: Record<string, unknown> };
  connectionParams?: Record<string, unknown>;
}): string | undefined => {
  const headers = gqlContext.req?.headers ?? {};
  const fromHeader = firstValue(
    headers['x-tracking-token'] ?? headers['X-Tracking-Token'],
  );
  if (fromHeader) return fromHeader;
  const params = gqlContext.connectionParams ?? {};
  return firstValue(params['x-tracking-token'] ?? params['X-Tracking-Token']);
};

export const TrackingToken = createParamDecorator(
  (_data: unknown, context: ExecutionContext): string | undefined =>
    extractTrackingToken(GqlExecutionContext.create(context).getContext()),
);
