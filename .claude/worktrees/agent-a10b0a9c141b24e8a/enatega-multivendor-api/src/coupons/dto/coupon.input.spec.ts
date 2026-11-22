import { ValidationPipe } from '@nestjs/common';
import { CouponInput } from './coupon.input';

// The admin coupon forms enter the discount with the shared `isCurrency` preset
// (up to 2 decimals), so the backend must accept a fractional discount.
describe('CouponInput (decimal discount)', () => {
  const pipe = new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
  });

  it('keeps a decimal discount intact', async () => {
    const input = (await pipe.transform(
      { title: 'SAVE', discount: 12.5, enabled: true },
      { type: 'body', metatype: CouponInput },
    )) as CouponInput;

    expect(input).toBeInstanceOf(CouponInput);
    expect(input.discount).toBe(12.5);
  });
});
