import { CatalogService } from './catalog.service';
import { ConflictException } from '@nestjs/common';

const execQuery = (resolved: unknown) => ({
  lean: jest.fn().mockReturnThis(),
  populate: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  exec: jest.fn().mockResolvedValue(resolved),
});

const configurationService = {
  get: jest.fn().mockResolvedValue({ currency: 'TND', currencyDecimalDigits: 3 }),
};

// Restaurant model only echoes the header after a mutation.
const restaurantModelStub = (id: string) => ({
  findById: jest.fn().mockReturnValue(execQuery({ _id: id })),
});

const makeService = (overrides: {
  restaurantModel?: any;
  categoryModel?: any;
  foodModel?: any;
  addonModel?: any;
  optionModel?: any;
  subCategoriesService?: any;
}) =>
  new CatalogService(
    overrides.restaurantModel as never,
    overrides.categoryModel as never,
    overrides.foodModel as never,
    overrides.addonModel as never,
    overrides.optionModel as never,
    overrides.subCategoriesService as never,
    configurationService as never,
    {} as never,
  );

describe('CatalogService', () => {
  const restaurantId = '6a3fac2f0756484e74658505';
  const categoryId = '6a3fad622426402050331b0b';

  it('writes a food document with minor units to the foods collection', async () => {
    const create = jest.fn().mockResolvedValue({});
    const service = makeService({
      restaurantModel: restaurantModelStub(restaurantId),
      foodModel: { create },
    });

    await service.createFood({
      restaurant: restaurantId,
      category: categoryId,
      title: 'Decimal Food',
      variations: [
        { title: 'Regular', price: 12.5, discounted: 0.75, addons: [], isOutOfStock: false },
      ],
    });

    const doc = create.mock.calls[0][0];
    expect(String(doc.restaurantId)).toBe(restaurantId);
    expect(String(doc.categoryId)).toBe(categoryId);
    expect(doc.variations[0]).toEqual(
      expect.objectContaining({
        title: 'Regular',
        price: 12.5,
        priceMinor: 12500,
        discounted: 0.75,
        discountedMinor: 750,
      }),
    );
  });

  it('updates only the food fields the client sent and keeps variation minor units', async () => {
    const foodId = '6a3fc2401786407ac9dd3f8f';
    const variationId = '6a3fc2401786407ac9dd3f8d';
    const updateOne = jest.fn().mockReturnValue(execQuery({}));
    const service = makeService({
      restaurantModel: restaurantModelStub(restaurantId),
      foodModel: { updateOne },
    });

    await service.editFood({
      _id: foodId,
      restaurant: restaurantId,
      category: categoryId,
      title: 'Braunkohl mit Bregenwurst',
      description: '',
      isActive: true,
      isOutOfStock: false,
      variations: [
        { _id: variationId, title: 'Regular', price: 5, discounted: 0, addons: [], isOutOfStock: false },
      ],
    });

    const [, update] = updateOne.mock.calls[0];
    expect(update.$set.title).toBe('Braunkohl mit Bregenwurst');
    expect(update.$set.description).toBe('');
    // image/subCategory were not sent, so they must not be overwritten.
    expect(update.$set).not.toHaveProperty('image');
    expect(update.$set).not.toHaveProperty('subCategory');
    expect(update.$set.variations[0]).toEqual(
      expect.objectContaining({ title: 'Regular', price: 5, priceMinor: 5000, discountedMinor: 0 }),
    );
  });

  it('dual-writes option minor units when creating and editing options', async () => {
    const optionId = '6a3fc2401786407ac9dd3f8d';
    const insertMany = jest.fn().mockResolvedValue([]);
    const updateOne = jest.fn().mockReturnValue(execQuery({}));
    const service = makeService({
      restaurantModel: restaurantModelStub(restaurantId),
      optionModel: { insertMany, updateOne },
    });

    await service.createOptions({
      restaurant: restaurantId,
      options: [{ title: 'Extra sauce', price: 1.235 }],
    });
    expect(insertMany.mock.calls[0][0][0]).toEqual(
      expect.objectContaining({ title: 'Extra sauce', price: 1.235, priceMinor: 1235 }),
    );

    await service.editOption({ _id: optionId, restaurant: restaurantId, price: 2.5 });
    expect(updateOne.mock.calls[0][1].$set).toEqual(
      expect.objectContaining({ price: 2.5, priceMinor: 2500 }),
    );
  });

  it('blocks category deletion when foods still belong to it', async () => {
    const foodModel = { countDocuments: jest.fn().mockReturnValue(execQuery(2)) };
    const subCategoriesService = { countByParentCategory: jest.fn().mockResolvedValue(0) };
    const deleteOne = jest.fn().mockReturnValue(execQuery({}));
    const service = makeService({
      restaurantModel: restaurantModelStub(restaurantId),
      categoryModel: { deleteOne },
      foodModel,
      subCategoriesService,
    });

    await expect(service.deleteCategory(categoryId, restaurantId)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(deleteOne).not.toHaveBeenCalled();
  });

  it('blocks category deletion when sub-categories are still attached', async () => {
    const foodModel = { countDocuments: jest.fn().mockReturnValue(execQuery(0)) };
    const subCategoriesService = { countByParentCategory: jest.fn().mockResolvedValue(1) };
    const deleteOne = jest.fn().mockReturnValue(execQuery({}));
    const service = makeService({
      restaurantModel: restaurantModelStub(restaurantId),
      categoryModel: { deleteOne },
      foodModel,
      subCategoriesService,
    });

    await expect(service.deleteCategory(categoryId, restaurantId)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(subCategoriesService.countByParentCategory).toHaveBeenCalledWith(categoryId);
    expect(deleteOne).not.toHaveBeenCalled();
  });

  it('resolves food ids for target categories from the foods collection', async () => {
    const find = jest.fn().mockReturnValue(execQuery([{ _id: 'f1' }, { _id: 'f2' }]));
    const service = makeService({ foodModel: { find } });

    await expect(
      service.getFoodIdsForCategories(restaurantId, [categoryId]),
    ).resolves.toEqual(['f1', 'f2']);
    expect(find).toHaveBeenCalled();
  });

  it('counts foods referencing a sub-category by id or title', async () => {
    const countDocuments = jest.fn().mockReturnValue(execQuery(3));
    const service = makeService({ foodModel: { countDocuments } });

    await expect(
      service.countFoodsUsingSubCategory(['sub-id', 'Sub Title']),
    ).resolves.toBe(3);
    expect(countDocuments).toHaveBeenCalledWith({
      subCategory: { $in: ['sub-id', 'Sub Title'] },
    });
  });

  it('attaches each category its foods in two queries', async () => {
    const categories = [
      { _id: categoryId, title: 'Mains', restaurantId },
      { _id: 'cat2', title: 'Drinks', restaurantId },
    ];
    const foods = [
      { _id: 'f1', categoryId, title: 'Soup' },
      { _id: 'f2', categoryId: 'cat2', title: 'Cola' },
    ];
    const service = makeService({
      categoryModel: { find: jest.fn().mockReturnValue(execQuery(categories)) },
      foodModel: { find: jest.fn().mockReturnValue(execQuery(foods)) },
    });

    const result = await service.categoriesWithFoodsForRestaurant(restaurantId);
    expect(result[0].foods).toHaveLength(1);
    expect(result[0].foods[0].title).toBe('Soup');
    expect(result[1].foods[0].title).toBe('Cola');
  });
});
