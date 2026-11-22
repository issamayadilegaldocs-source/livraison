import { ValidationPipe } from '@nestjs/common';
import { CreateOptionInput, EditOptionInput, FoodInput } from './catalog.input';

describe('FoodInput', () => {
  const pipe = new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
    forbidUnknownValues: true,
  });

  it('accepts the admin create-food payload with variations', async () => {
    const input = await pipe.transform(
      {
        _id: '',
        restaurant: '6a3fac2f0756484e74658505',
        category: '6a3fad622426402050331b0b',
        title: 'Braunkohl mit Bregenwurst',
        description: '',
        image: 'https://res.cloudinary.com/dsikloief/image/upload/v1782558071/enatega/pfxlkpjwehbysnukyzul.jpg',
        isActive: true,
        isOutOfStock: false,
        variations: [
          {
            title: 'Regular',
            price: 5,
            addons: [
              '6a3fbef8f11cb3b8fb1b1e3d',
              '6a3fbef8f11cb3b8fb1b1e3e',
              '6a3fbef8f11cb3b8fb1b1e3f',
              '6a3fbef8f11cb3b8fb1b1e40',
            ],
            isOutOfStock: false,
            discounted: 0,
          },
          {
            title: 'Large',
            price: 8,
            addons: [
              '6a3fbef8f11cb3b8fb1b1e3d',
              '6a3fbef8f11cb3b8fb1b1e3e',
              '6a3fbef8f11cb3b8fb1b1e3f',
              '6a3fbef8f11cb3b8fb1b1e40',
            ],
            isOutOfStock: false,
            discounted: 0,
          },
        ],
      },
      { type: 'body', metatype: FoodInput },
    );

    expect(input).toBeInstanceOf(FoodInput);
    expect(input._id).toBeUndefined();
    expect(input.variations).toHaveLength(2);
    expect(input.variations?.[0]).toMatchObject({
      title: 'Regular',
      price: 5,
      isOutOfStock: false,
      discounted: 0,
    });
  });

  it('normalizes comma decimal variation money values', async () => {
    const input = await pipe.transform(
      {
        restaurant: '6a3fac2f0756484e74658505',
        category: '6a3fad622426402050331b0b',
        title: 'Decimal Food',
        variations: [
          {
            title: 'Regular',
            price: '12,50',
            discounted: '0,75',
            addons: [],
            isOutOfStock: false,
          },
        ],
      },
      { type: 'body', metatype: FoodInput },
    );

    expect(input.variations?.[0].price).toBe(12.5);
    expect(input.variations?.[0].discounted).toBe(0.75);
  });

  it('strips surrounding whitespace and thousands spaces before parsing money', async () => {
    const input = await pipe.transform(
      {
        restaurant: '6a3fac2f0756484e74658505',
        category: '6a3fad622426402050331b0b',
        title: 'Spaced Price',
        variations: [{ title: 'Regular', price: ' 1 234,50 ' }],
      },
      { type: 'body', metatype: FoodInput },
    );

    expect(input.variations?.[0].price).toBe(1234.5);
  });

  it('treats a blank price string as undefined rather than NaN', async () => {
    const input = await pipe.transform(
      {
        restaurant: '6a3fac2f0756484e74658505',
        category: '6a3fad622426402050331b0b',
        title: 'Empty Price',
        variations: [{ title: 'Regular', price: '  ' }],
      },
      { type: 'body', metatype: FoodInput },
    );

    expect(input.variations?.[0].price).toBeUndefined();
  });

  it('rejects a non-numeric price string instead of coercing it to NaN', async () => {
    // A non-parseable string is left untouched so @IsNumber fails loudly rather
    // than silently persisting NaN.
    await expect(
      pipe.transform(
        {
          restaurant: '6a3fac2f0756484e74658505',
          category: '6a3fad622426402050331b0b',
          title: 'Bad Price',
          variations: [{ title: 'Regular', price: 'free' }],
        },
        { type: 'body', metatype: FoodInput },
      ),
    ).rejects.toThrow();
  });

  it('rejects unknown food properties', async () => {
    await expect(
      pipe.transform(
        {
          restaurant: '6a3fac2f0756484e74658505',
          category: '6a3fad622426402050331b0b',
          title: 'Braunkohl mit Bregenwurst',
          unexpected: true,
        },
        { type: 'body', metatype: FoodInput },
      ),
    ).rejects.toThrow();
  });
});

describe('Option inputs decimal prices', () => {
  const pipe = new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
    forbidUnknownValues: true,
  });

  it('normalizes comma decimals on CreateOptionInput option items', async () => {
    const input = await pipe.transform(
      {
        restaurant: '6a3fac2f0756484e74658505',
        options: [{ title: 'Extra cheese', price: '1,25' }],
      },
      { type: 'body', metatype: CreateOptionInput },
    );

    expect(input.options[0].price).toBe(1.25);
  });

  it('normalizes comma decimals on EditOptionInput', async () => {
    const input = await pipe.transform(
      {
        _id: '6a3fbef8f11cb3b8fb1b1e3d',
        restaurant: '6a3fac2f0756484e74658505',
        title: 'Extra cheese',
        price: '2,50',
      },
      { type: 'body', metatype: EditOptionInput },
    );

    expect(input.price).toBe(2.5);
  });
});
