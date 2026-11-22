export interface PushDeliveryResult {
  provider: string;
  token: string;
  accepted: boolean;
  permanentFailure: boolean;
  ticketId?: string;
  errorCode?: string;
  message?: string;
  raw?: unknown;
}
