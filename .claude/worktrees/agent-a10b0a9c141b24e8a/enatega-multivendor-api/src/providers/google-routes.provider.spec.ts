import axios from 'axios';
import { GoogleRoutesProvider } from './google-routes.provider';

jest.mock('axios', () => ({
  __esModule: true,
  default: { create: jest.fn() },
}));

describe('GoogleRoutesProvider', () => {
  const post = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (axios.create as jest.Mock).mockReturnValue({ post });
  });

  const provider = (key: string | undefined) =>
    new GoogleRoutesProvider({ get: jest.fn().mockReturnValue(key) } as never);

  it('rounds a valid route duration up to minutes', async () => {
    post.mockResolvedValue({ status: 200, data: [{ condition: 'ROUTE_EXISTS', duration: '121s' }] });
    await expect(provider('secret').travelMinutes([13, 52], [14, 53])).resolves.toBe(3);
  });

  it.each([
    [{ status: 500, data: [] }],
    [{ status: 200, data: [] }],
    [{ status: 200, data: [{ condition: 'ROUTE_NOT_FOUND', duration: '60s' }] }],
    [{ status: 200, data: [{ condition: 'ROUTE_EXISTS', duration: 'bad' }] }],
    [{ status: 200, data: [{ condition: 'ROUTE_EXISTS', duration: '0s' }] }],
  ])('returns null for an unusable response', async (response) => {
    post.mockResolvedValue(response);
    await expect(provider('secret').travelMinutes([13, 52], [14, 53])).resolves.toBeNull();
  });

  it('returns null for missing configuration and request failures', async () => {
    await expect(provider(undefined).travelMinutes([13, 52], [14, 53])).resolves.toBeNull();
    expect(post).not.toHaveBeenCalled();
    post.mockRejectedValue(new Error('timeout'));
    await expect(provider('secret').travelMinutes([13, 52], [14, 53])).resolves.toBeNull();
  });
});
