import { OffersService } from './offers.service';

describe('OffersService money calculations', () => {
  const makeService = () =>
    new OffersService({} as never, {} as never, {} as never, {} as never);

  it('rounds percentage discounts at the configured currency scale', () => {
    const service = makeService();

    const discount = service.computeDiscount(
      {
        type: 'PERCENTAGE',
        value: 12.5,
        scope: 'CART',
      },
      [],
      1,
      undefined,
      { currency: 'TND', scale: 3 },
    );

    expect(discount).toBe(0.125);
  });

  it('applies maxDiscount using the configured currency scale', () => {
    const service = makeService();

    const discount = service.computeDiscount(
      {
        type: 'PERCENTAGE',
        value: 50,
        scope: 'CART',
        maxDiscount: 0.3334,
      },
      [],
      10,
      undefined,
      { currency: 'TND', scale: 3 },
    );

    expect(discount).toBe(0.333);
  });
});
