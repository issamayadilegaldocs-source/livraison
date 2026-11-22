export const ORDER_PAYMENT_PORT = Symbol('ORDER_PAYMENT_PORT');

export interface OrderPaymentContext {
  orderId: string;
  orderRef?: string;
  orderAmount: number;
  orderAmountMinor?: number;
  orderAmountCurrency?: string;
  orderAmountScale?: number;
  paymentStatus?: string;
  paymentReference?: string;
}

export interface AttachPaymentSessionInput {
  provider: string;
  reference: string;
  link: string;
}

export interface ConfirmOrderPaidInput {
  orderId: string;
  provider: string;
  reference: string;
  paidAmount: number;
  paidAmountMinor?: number;
}

export interface OrderPaymentPort {
  getPaymentContext(orderId: string): Promise<OrderPaymentContext>;
  attachPaymentSession(orderId: string, session: AttachPaymentSessionInput): Promise<void>;
  confirmPaid(input: ConfirmOrderPaidInput): Promise<void>;
}
