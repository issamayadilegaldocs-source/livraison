import { ConflictException } from '@nestjs/common';
import { DeleteTypeEnum } from './dto/shop-type.input';
import { ShopTypesService } from './shop-types.service';

const query = (resolved: unknown) => ({
  lean: jest.fn().mockReturnThis(),
  exec: jest.fn().mockResolvedValue(resolved),
});

describe('ShopTypesService', () => {
  it('blocks hard deletion when restaurants report the shop category is still attached', async () => {
    const shopTypeModel = {
      findById: jest.fn().mockReturnValue(query({ _id: 'shop_1', slug: 'grocery' })),
      findByIdAndDelete: jest.fn(),
    };
    const restaurantsService = {
      countRestaurantsUsingShopCategory: jest.fn().mockResolvedValue(1),
    };
    const service = new ShopTypesService(shopTypeModel as never, restaurantsService as never);

    await expect(service.delete('shop_1', DeleteTypeEnum.HARD)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(restaurantsService.countRestaurantsUsingShopCategory).toHaveBeenCalledWith('grocery');
    expect(shopTypeModel.findByIdAndDelete).not.toHaveBeenCalled();
  });
});
