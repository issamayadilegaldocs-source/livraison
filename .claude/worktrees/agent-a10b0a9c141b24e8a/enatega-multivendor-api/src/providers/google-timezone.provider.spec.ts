import axios from 'axios';
import { GoogleTimezoneProvider } from './google-timezone.provider';

jest.mock('axios', () => ({
  __esModule: true,
  default: { create: jest.fn() },
}));

describe('GoogleTimezoneProvider', () => {
  const get = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (axios.create as jest.Mock).mockReturnValue({ get });
  });

  const provider = (key: string | undefined) =>
    new GoogleTimezoneProvider({ get: jest.fn().mockReturnValue(key) } as never);

  it('parses timeZoneId from a successful response', async () => {
    get.mockResolvedValue({ status: 200, data: { status: 'OK', timeZoneId: 'Europe/Berlin' } });
    await expect(provider('secret').timezoneFor([13.405, 52.52])).resolves.toBe('Europe/Berlin');
  });

  it.each([
    [{ status: 500, data: {} }],
    [{ status: 200, data: { status: 'ZERO_RESULTS' } }],
    [{ status: 200, data: { status: 'OK', timeZoneId: '' } }],
    [{ status: 200, data: {} }],
  ])('returns null for an unusable response', async (response) => {
    get.mockResolvedValue(response);
    await expect(provider('secret').timezoneFor([13.405, 52.52])).resolves.toBeNull();
  });

  it('returns null for missing configuration and request failures', async () => {
    await expect(provider(undefined).timezoneFor([13.405, 52.52])).resolves.toBeNull();
    expect(get).not.toHaveBeenCalled();
    get.mockRejectedValue(new Error('timeout'));
    await expect(provider('secret').timezoneFor([13.405, 52.52])).resolves.toBeNull();
  });

  it('returns null for non-finite coordinates without calling the API', async () => {
    await expect(provider('secret').timezoneFor([NaN, 52.52])).resolves.toBeNull();
    expect(get).not.toHaveBeenCalled();
  });
});
