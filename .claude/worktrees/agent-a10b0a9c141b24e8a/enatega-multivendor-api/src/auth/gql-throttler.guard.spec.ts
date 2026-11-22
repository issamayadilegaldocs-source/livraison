import { ExecutionContext } from '@nestjs/common';
import { GqlThrottlerGuard } from './gql-throttler.guard';

function contextWith(gqlContext: Record<string, unknown>): ExecutionContext {
  return {
    getType: () => 'graphql',
    getClass: () => ({}),
    getHandler: () => ({}),
    getArgs: () => [undefined, undefined, gqlContext, undefined],
  } as unknown as ExecutionContext;
}

describe('GqlThrottlerGuard', () => {
  // getRequestResponse is `protected`; cast to access it directly in tests
  // rather than driving the full ThrottlerGuard.canActivate pipeline.
  const invoke = (guard: GqlThrottlerGuard, ctx: ExecutionContext) =>
    (guard as unknown as { getRequestResponse: (c: ExecutionContext) => { req: unknown; res: unknown } })
      .getRequestResponse(ctx);

  it('extracts the HTTP request/response from a standard GraphQL HTTP context', () => {
    const guard = new GqlThrottlerGuard({} as never, {} as never, {} as never);
    const req = { headers: {}, ip: '1.2.3.4', res: { header: jest.fn() } };
    const { req: extractedReq, res } = invoke(guard, contextWith({ req }));
    expect(extractedReq).toBe(req);
    expect(res).toBe(req.res);
  });

  it('falls back to gqlContext.extra.request for graphql-ws subscription contexts', () => {
    const guard = new GqlThrottlerGuard({} as never, {} as never, {} as never);
    const wsReq = { headers: {}, ip: '5.6.7.8' };
    const { req } = invoke(guard, contextWith({ req: undefined, extra: { request: wsReq } }));
    expect(req).toBe(wsReq);
  });

  it('synthesizes a minimal request keyed by connectionParams.ip when nothing else is available', () => {
    const guard = new GqlThrottlerGuard({} as never, {} as never, {} as never);
    const { req, res } = invoke(
      guard,
      contextWith({ req: undefined, connectionParams: { ip: '9.9.9.9' } }),
    );
    expect(req).toEqual({ headers: {}, ip: '9.9.9.9' });
    expect((res as { header: () => unknown }).header()).toBeUndefined();
  });

  it('defaults ip to "graphql-ws" when no connectionParams.ip is present either', () => {
    const guard = new GqlThrottlerGuard({} as never, {} as never, {} as never);
    const { req } = invoke(guard, contextWith({ req: undefined }));
    expect((req as { ip: string }).ip).toBe('graphql-ws');
  });
});
