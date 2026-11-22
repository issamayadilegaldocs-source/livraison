import { ConflictException } from '@nestjs/common';
import { SubCategoriesService } from './sub-categories.service';

const query = (resolved: unknown) => ({
  lean: jest.fn().mockReturnThis(),
  exec: jest.fn().mockResolvedValue(resolved),
});

describe('SubCategoriesService', () => {
  it('counts child sub-categories by parent category in its own collection', async () => {
    const countDocuments = jest.fn().mockReturnValue(query(3));
    const service = new SubCategoriesService(
      { countDocuments } as never,
      {} as never,
    );

    await expect(service.countByParentCategory('category_1')).resolves.toBe(3);
    expect(countDocuments).toHaveBeenCalledWith({ parentCategoryId: 'category_1' });
  });

  it('blocks deletion when restaurants report products using the sub-category', async () => {
    const subCategoryModel = {
      findById: jest.fn().mockReturnValue(query({ _id: 'sub_1', title: 'Pizza' })),
      findByIdAndDelete: jest.fn(),
    };
    const restaurantsService = {
      countFoodsUsingSubCategory: jest.fn().mockResolvedValue(2),
    };
    const service = new SubCategoriesService(
      subCategoryModel as never,
      restaurantsService as never,
    );

    await expect(service.delete('sub_1')).rejects.toBeInstanceOf(ConflictException);
    expect(restaurantsService.countFoodsUsingSubCategory).toHaveBeenCalledWith([
      'sub_1',
      'Pizza',
    ]);
    expect(subCategoryModel.findByIdAndDelete).not.toHaveBeenCalled();
  });
});
