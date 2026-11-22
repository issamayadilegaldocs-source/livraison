import axios from 'axios';
import { ExpoPushProvider } from './expo-push.provider';

jest.mock('axios', () => ({
  __esModule: true,
  default: { post: jest.fn() },
}));

describe('ExpoPushProvider', () => {
  const message = {
    to: 'expo-token',
    title: 'Title',
    body: 'Body',
    priority: 'high' as const,
    channelId: 'incoming_call',
    data: { type: 'TEST' },
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns an accepted provider-neutral result for ok tickets', async () => {
    (axios.post as jest.Mock).mockResolvedValue({
      data: { data: { status: 'ok', id: 'ticket-1' } },
    });

    await expect(new ExpoPushProvider().send(message)).resolves.toMatchObject({
      provider: 'expo',
      token: 'expo-token',
      accepted: true,
      permanentFailure: false,
      ticketId: 'ticket-1',
    });
  });

  it('classifies Expo permanent token failures from ticket responses', async () => {
    (axios.post as jest.Mock).mockResolvedValue({
      data: {
        data: {
          status: 'error',
          message: 'The recipient device is not registered.',
          details: { error: 'DeviceNotRegistered' },
        },
      },
    });

    await expect(new ExpoPushProvider().send(message)).resolves.toMatchObject({
      provider: 'expo',
      token: 'expo-token',
      accepted: false,
      permanentFailure: true,
      errorCode: 'DeviceNotRegistered',
    });
  });

  it('returns a transient failure result for transport errors', async () => {
    (axios.post as jest.Mock).mockRejectedValue(new Error('timeout'));

    await expect(new ExpoPushProvider().send(message)).resolves.toMatchObject({
      provider: 'expo',
      token: 'expo-token',
      accepted: false,
      permanentFailure: false,
      message: 'timeout',
    });
  });
});
