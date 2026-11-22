import { buildOrderMoneyBackfillPatch } from './backfill-order-money';

describe('buildOrderMoneyBackfillPatch', () => {
  it('fills missing order amount metadata using the configured currency scale', () => {
    expect(
      buildOrderMoneyBackfillPatch(
        {
          orderAmount: 23.450000000000003,
          paymentStatus: 'UNPAID',
        },
        { currency: 'TND', scale: 3 },
      ),
    ).toEqual({
      orderAmountMinor: 23450,
      orderAmountCurrency: 'TND',
      orderAmountScale: 3,
    });
  });

  it('uses existing order currency metadata instead of the current global config', () => {
    expect(
      buildOrderMoneyBackfillPatch(
        {
          orderAmount: 10.005,
          orderAmountCurrency: 'USD',
          orderAmountScale: 2,
        },
        { currency: 'TND', scale: 3 },
      ),
    ).toEqual({
      orderAmountMinor: 1000,
      orderAmountCurrency: 'USD',
      orderAmountScale: 2,
    });
  });

  it('fills paidAmountMinor from legacy paidAmount when present', () => {
    expect(
      buildOrderMoneyBackfillPatch(
        {
          orderAmount: 12,
          orderAmountMinor: 12000,
          orderAmountCurrency: 'TND',
          orderAmountScale: 3,
          paidAmount: 11.1255,
          paymentStatus: 'PAID',
        },
        { currency: 'TND', scale: 3 },
      ),
    ).toEqual({
      paidAmountMinor: 11126,
    });
  });

  it('falls back to orderAmount for paid/refunded orders without a useful paidAmount', () => {
    expect(
      buildOrderMoneyBackfillPatch(
        {
          orderAmount: 7.555,
          orderAmountMinor: 7555,
          orderAmountCurrency: 'TND',
          orderAmountScale: 3,
          paidAmount: 0,
          paymentStatus: 'REFUNDED',
        },
        { currency: 'TND', scale: 3 },
      ),
    ).toEqual({
      paidAmountMinor: 7555,
    });
  });

  it('does not invent paid minor units for unpaid orders with default paidAmount zero', () => {
    expect(
      buildOrderMoneyBackfillPatch(
        {
          orderAmount: 7.555,
          orderAmountMinor: 7555,
          orderAmountCurrency: 'TND',
          orderAmountScale: 3,
          paidAmount: 0,
          paymentStatus: 'UNPAID',
        },
        { currency: 'TND', scale: 3 },
      ),
    ).toEqual({});
  });

  it('fills missing order component minor fields from legacy amounts', () => {
    expect(
      buildOrderMoneyBackfillPatch(
        {
          orderAmount: 20,
          orderAmountMinor: 20000,
          orderAmountCurrency: 'TND',
          orderAmountScale: 3,
          deliveryCharges: 2.5555,
          tipping: 1.005,
          taxationAmount: 0.125,
          discountAmount: 3.3335,
          loyaltyDiscount: 0.5,
          expressSurcharge: 2,
          riderCommission: 0.3335,
          riderEarnings: 0.6665,
        },
        { currency: 'TND', scale: 3 },
      ),
    ).toEqual({
      deliveryChargesMinor: 2556,
      tippingMinor: 1005,
      taxationAmountMinor: 125,
      discountAmountMinor: 3334,
      loyaltyDiscountMinor: 500,
      expressSurchargeMinor: 2000,
      riderCommissionMinor: 334,
      riderEarningsMinor: 666,
    });
  });

  it('leaves existing order component minor fields untouched', () => {
    expect(
      buildOrderMoneyBackfillPatch(
        {
          orderAmount: 20,
          orderAmountMinor: 20000,
          orderAmountCurrency: 'TND',
          orderAmountScale: 3,
          deliveryCharges: 2.5555,
          deliveryChargesMinor: 2555,
        },
        { currency: 'TND', scale: 3 },
      ),
    ).toEqual({});
  });
});
