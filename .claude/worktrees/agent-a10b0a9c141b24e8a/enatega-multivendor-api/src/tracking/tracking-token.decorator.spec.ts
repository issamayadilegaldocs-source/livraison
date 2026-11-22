import { extractTrackingToken } from './tracking-token.decorator';

describe('extractTrackingToken', () => {
  it('reads the token from the HTTP request header', () => {
    expect(
      extractTrackingToken({ req: { headers: { 'x-tracking-token': 'http-token' } } }),
    ).toBe('http-token');
  });

  it('reads the token from graphql-ws connectionParams over WebSocket', () => {
    expect(
      extractTrackingToken({ connectionParams: { 'x-tracking-token': 'ws-token' } }),
    ).toBe('ws-token');
  });

  it('prefers the HTTP header when both are present', () => {
    expect(
      extractTrackingToken({
        req: { headers: { 'x-tracking-token': 'http-token' } },
        connectionParams: { 'x-tracking-token': 'ws-token' },
      }),
    ).toBe('http-token');
  });

  it('returns undefined when no token is present on either transport', () => {
    expect(extractTrackingToken({ req: { headers: {} }, connectionParams: {} })).toBeUndefined();
    expect(extractTrackingToken({})).toBeUndefined();
  });
});
