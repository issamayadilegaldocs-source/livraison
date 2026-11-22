import { ConflictException } from '@nestjs/common';
import { CuisinesService } from './cuisines.service';

const query = (resolved: unknown) => ({
  lean: jest.fn().mockReturnThis(),
  exec: jest.fn().mockResolvedValue(resolved),
});

describe('CuisinesService', () => {
  // Regression (found by the web E2E suite): the web discovery page calls
  // nearByRestaurantsCuisines with shopType null (it fetches all cuisines
  // once and splits restaurant/grocery client-side), which the previously
  // non-nullable arg rejected with a GraphQL validation error on every
  // discovery load.
  describe('findByShopType', () => {
    it('returns all cuisines when no shopType is given (web discovery "all" fetch)', async () => {
      const find = jest.fn().mockReturnValue(query([{ _id: 'c1' }, { _id: 'c2' }]));
      const service = new CuisinesService({ find } as never, {} as never);

      await expect(service.findByShopType(null)).resolves.toHaveLength(2);
      expect(find).toHaveBeenCalledWith({});
    });

    it('filters by shopType when one is provided', async () => {
      const find = jest.fn().mockReturnValue(query([{ _id: 'c1' }]));
      const service = new CuisinesService({ find } as never, {} as never);

      await service.findByShopType('grocery');
      expect(find).toHaveBeenCalledWith({ shopType: 'grocery' });
    });
  });

  it('blocks deletion when restaurants report the cuisine is still attached', async () => {
    const cuisineModel = {
      findById: jest.fn().mockReturnValue(query({ _id: 'cuisine_1', name: 'Tunisian' })),
      findByIdAndDelete: jest.fn(),
    };
    const restaurantsService = {
      countRestaurantsUsingCuisine: jest.fn().mockResolvedValue(1),
    };
    const service = new CuisinesService(cuisineModel as never, restaurantsService as never);

    await expect(service.delete('cuisine_1')).rejects.toBeInstanceOf(ConflictException);
    expect(restaurantsService.countRestaurantsUsingCuisine).toHaveBeenCalledWith('Tunisian');
    expect(cuisineModel.findByIdAndDelete).not.toHaveBeenCalled();
  });
});
