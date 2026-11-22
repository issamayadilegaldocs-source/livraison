import { ValidationPipe } from '@nestjs/common';
import {
  DeliveryInfoInput,
  RestaurantProfileInput,
} from './restaurant.input';

// These DTOs back the admin restaurant delivery / business-details / profile
// forms. The admin now enters money as decimals (via the shared `isCurrency`
// input preset), so the backend contract must keep accepting fractional values
// as numbers — never round or reject them. Guards against anyone swapping a
// money field from `@Field(() => Float)` / `@IsNumber()` to an integer type.
describe('Restaurant money inputs (decimal round-trip)', () => {
  const pipe = new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
  });

  it('keeps decimal delivery fees and distance intact', async () => {
    const input = (await pipe.transform(
      {
        minDeliveryFee: 2.5,
        deliveryDistance: 3.75,
        deliveryFee: 0.99,
      },
      { type: 'body', metatype: DeliveryInfoInput },
    )) as DeliveryInfoInput;

    expect(input).toBeInstanceOf(DeliveryInfoInput);
    expect(input.minDeliveryFee).toBe(2.5);
    expect(input.deliveryDistance).toBe(3.75);
    expect(input.deliveryFee).toBe(0.99);
  });

  it('keeps decimal minimum order and tax rates intact', async () => {
    const input = (await pipe.transform(
      {
        _id: '6a3fac2f0756484e74658505',
        minimumOrder: 12.5,
        tax: 8.25,
        salesTax: 5.5,
      },
      { type: 'body', metatype: RestaurantProfileInput },
    )) as RestaurantProfileInput;

    expect(input.minimumOrder).toBe(12.5);
    expect(input.tax).toBe(8.25);
    expect(input.salesTax).toBe(5.5);
  });
});
