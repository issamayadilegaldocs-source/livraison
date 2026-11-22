import { VariationMoneyResolver, OptionMoneyResolver } from './catalog-money.resolver';

describe('catalog money resolvers', () => {
  const configurationService = {
    get: jest.fn().mockResolvedValue({ currency: 'TND', currencyDecimalDigits: 3 }),
  } as any;

  beforeEach(() => {
    configurationService.get.mockClear();
    configurationService.get.mockResolvedValue({ currency: 'TND', currencyDecimalDigits: 3 });
  });

  describe('VariationMoneyResolver', () => {
    it('derives variation price/discounted Money at the global currency scale', async () => {
      const resolver = new VariationMoneyResolver(configurationService);
      const variation = { priceMinor: 5500, discountedMinor: 4990 };

      expect(await resolver.priceMoney(variation)).toEqual({
        currency: 'TND',
        scale: 3,
        amount: '5.500',
        minorUnits: '5500',
      });
      expect(await resolver.discountedMoney(variation)).toEqual({
        currency: 'TND',
        scale: 3,
        amount: '4.990',
        minorUnits: '4990',
      });
    });

    it('caches the global currency config across many embedded items', async () => {
      const resolver = new VariationMoneyResolver(configurationService);
      await resolver.priceMoney({ priceMinor: 1000 });
      await resolver.discountedMoney({ discountedMinor: 1000 });
      await resolver.priceMoney({ priceMinor: 2000 });

      expect(configurationService.get).toHaveBeenCalledTimes(1);
    });

    it('returns null when minor-unit fields are absent', async () => {
      const resolver = new VariationMoneyResolver(configurationService);
      expect(await resolver.priceMoney({ price: 5.5 })).toBeNull();
      expect(await resolver.discountedMoney({})).toBeNull();
    });
  });

  describe('OptionMoneyResolver', () => {
    it('derives option price Money at the global currency scale', async () => {
      const resolver = new OptionMoneyResolver(configurationService);
      expect(await resolver.priceMoney({ priceMinor: 1250 })).toEqual({
        currency: 'TND',
        scale: 3,
        amount: '1.250',
        minorUnits: '1250',
      });
    });

    it('returns null when the option has no minor-unit price', async () => {
      const resolver = new OptionMoneyResolver(configurationService);
      expect(await resolver.priceMoney({ price: 1.25 })).toBeNull();
    });
  });
});
