import { ExecutionContext, Injectable } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { ThrottlerGuard } from '@nestjs/throttler';

/**
 * Extracts the HTTP request from the GraphQL execution context so that the
 * standard ThrottlerGuard can identify the caller by IP for rate limiting.
 */
@Injectable()
export class GqlThrottlerGuard extends ThrottlerGuard {
  protected getRequestResponse(context: ExecutionContext) {
    const ctx = GqlExecutionContext.create(context);
    const gqlContext = ctx.getContext();
    const req =
      gqlContext.req ??
      gqlContext.extra?.request ??
      {
        headers: {},
        ip: gqlContext.connectionParams?.ip ?? 'graphql-ws',
      };
    const res = req.res ?? { header: () => undefined };

    return { req, res };
  }
}
