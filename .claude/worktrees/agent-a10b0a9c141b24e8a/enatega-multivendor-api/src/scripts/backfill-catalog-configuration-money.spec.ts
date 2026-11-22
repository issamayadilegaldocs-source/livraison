import {
  buildConfigurationPriceMoneyBackfillPatch,
  buildRestaurantCatalogMoneyBackfillPatch,
} from './backfill-catalog-configuration-money';

describe('buildRestaurantCatalogMoneyBackfillPatch', () => {
  it('fills missing variation and option minor fields at the configured scale', () => {
    expect(
      buildRestaurantCatalogMoneyBackfillPatch(
        {
          categories: [
            {
              foods: [
                {
                  variations: [
                    {
                      price: 10.1255,
                      discounted: 9.5555,
                    },
                  ],
                },
              ],
            },
          ],
          options: [{ price: 0.3335 }],
        },
        { currency: 'TND', scale: 3 },
      ),
    ).toEqual({
      'categories.0.foods.0.variations.0.priceMinor': 10126,
      'categories.0.foods.0.variations.0.discountedMinor': 9556,
      'options.0.priceMinor': 334,
    });
  });

  it('preserves existing catalog minor fields', () => {
    expect(
      buildRestaurantCatalogMoneyBackfillPatch(
        {
          categories: [
            {
              foods: [
                {
                  variations: [
                    {
                      price: 10.1255,
                      priceMinor: 10125,
                      discounted: 9.5555,
                      discountedMinor: 9555,
                    },
                  ],
                },
              ],
            },
          ],
          options: [{ price: 0.3335, priceMinor: 333 }],
        },
        { currency: 'TND', scale: 3 },
      ),
    ).toEqual({});
  });

  it('defaults missing legacy catalog amounts to zero for schema-defaulted prices', () => {
    expect(
      buildRestaurantCatalogMoneyBackfillPatch(
        {
          categories: [{ foods: [{ variations: [{}] }] }],
          options: [{}],
        },
        { currency: 'USD', scale: 2 },
      ),
    ).toEqual({
      'categories.0.foods.0.variations.0.priceMinor': 0,
      'categories.0.foods.0.variations.0.discountedMinor': 0,
      'options.0.priceMinor': 0,
    });
  });
});

describe('buildConfigurationPriceMoneyBackfillPatch', () => {
  it('fills missing configured price minor fields using the document currency scale', () => {
    expect(
      buildConfigurationPriceMoneyBackfillPatch({
        currency: 'TND',
        currencyDecimalDigits: 3,
        deliveryRate: 1.005,
        baseDeliveryFee: 2.5555,
        expressSurcharge: 3.3335,
      }),
    ).toEqual({
      deliveryRateMinor: 1005,
      baseDeliveryFeeMinor: 2556,
      expressSurchargeMinor: 3334,
    });
  });

  it('preserves existing configured price minor fields', () => {
    expect(
      buildConfigurationPriceMoneyBackfillPatch({
        currency: 'TND',
        currencyDecimalDigits: 3,
        deliveryRate: 1.005,
        deliveryRateMinor: 1004,
        baseDeliveryFee: 2.5555,
        baseDeliveryFeeMinor: 2555,
        expressSurcharge: 3.3335,
        expressSurchargeMinor: 3333,
      }),
    ).toEqual({});
  });

  it('uses default currency settings when legacy configuration lacks currency metadata', () => {
    expect(
      buildConfigurationPriceMoneyBackfillPatch({
        deliveryRate: 1.005,
        baseDeliveryFee: 2.555,
        expressSurcharge: 3.335,
      }),
    ).toEqual({
      deliveryRateMinor: 100,
      baseDeliveryFeeMinor: 256,
      expressSurchargeMinor: 334,
    });
  });
});
