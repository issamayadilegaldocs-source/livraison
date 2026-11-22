import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';

/**
 * Reads the optional `Idempotency-Key` request header from the GraphQL context.
 * Clients send a UUID v4 on mutations that must not be duplicated (e.g. offer
 * creation) so a retry returns the original result instead of a second write.
 */
export const IdempotencyKey = createParamDecorator(
  (_data: unknown, context: ExecutionContext): string | undefined => {
    const gqlContext = GqlExecutionContext.create(context).getContext();
    const headers = gqlContext.req?.headers ?? {};
    const value = headers['idempotency-key'] ?? headers['Idempotency-Key'];
    return Array.isArray(value) ? value[0] : value;
  },
);
