import { forwardRef, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Restaurant, RestaurantDocument } from './restaurant.schema';
import { Category, CategoryDocument } from './catalog/category.schema';
import { Food, FoodDocument } from './catalog/food.schema';
import { Addon, AddonDocument } from './catalog/addon.schema';
import { Option, OptionDocument } from './catalog/option.schema';
import { SubCategoriesService } from '../sub-categories/sub-categories.service';
import {
  CategoryInput,
  FoodInput,
  AddonInput,
  AddonItemInput,
  EditAddonInput,
  CreateOptionInput,
  EditOptionInput,
  OptionItemInput,
} from './dto/catalog.input';
import { assertNoDependents } from '../common/referential-integrity.util';
import { Money, MoneyCurrency } from '../common/money/money';
import { ConfigurationService } from '../configuration/configuration.service';
import { AppPubSub, PUB_SUB } from '../pubsub/pubsub.module';
import { Events } from '../subscriptions/events';

/**
 * Owns the normalized catalog collections (`categories`, `foods`, `addons`,
 * `options`) extracted out of the embedded `restaurant` document (slice 4b).
 * It is the sole reader/writer of those collections. The only dependency back
 * on the Restaurant model is `byId`, which echoes the restaurant header so the
 * existing catalog mutations can keep returning `RestaurantModel` — the menu
 * itself is resolved lazily from these collections via field resolvers.
 */
@Injectable()
export class CatalogService {
  constructor(
    @InjectModel(Restaurant.name)
    private readonly restaurantModel: Model<RestaurantDocument>,
    @InjectModel(Category.name)
    private readonly categoryModel: Model<CategoryDocument>,
    @InjectModel(Food.name)
    private readonly foodModel: Model<FoodDocument>,
    @InjectModel(Addon.name)
    private readonly addonModel: Model<AddonDocument>,
    @InjectModel(Option.name)
    private readonly optionModel: Model<OptionDocument>,
    @Inject(forwardRef(() => SubCategoriesService))
    private readonly subCategoriesService: SubCategoriesService,
    private readonly configurationService: ConfigurationService,
    @Inject(PUB_SUB) private readonly pubSub: AppPubSub,
  ) {}

  private async byId(id: string): Promise<RestaurantDocument> {
    const doc = await this.restaurantModel
      .findById(id)
      .populate('owner', '_id email isActive')
      .exec();
    if (!doc) throw new NotFoundException(`Restaurant ${id} not found`);
    return doc;
  }

  // ── Categories ───────────────────────────────────────────────────────────

  async createCategory(input: CategoryInput): Promise<RestaurantDocument> {
    await this.categoryModel.create({
      restaurantId: new Types.ObjectId(input.restaurant),
      title: input.title,
      image: input.image,
    });
    return this.byId(input.restaurant);
  }

  async editCategory(input: CategoryInput): Promise<RestaurantDocument> {
    const patch: Record<string, unknown> = {};
    if (input.title !== undefined) patch.title = input.title;
    if (input.image !== undefined) patch.image = input.image;

    await this.categoryModel
      .updateOne(
        { _id: new Types.ObjectId(input._id!), restaurantId: new Types.ObjectId(input.restaurant) },
        { $set: patch },
      )
      .exec();
    return this.byId(input.restaurant);
  }

  async deleteCategory(id: string, restaurant: string): Promise<RestaurantDocument> {
    // Referential integrity: refuse to delete a category that still holds
    // products or sub-categories — removing it would silently orphan them.
    const foodCount = await this.foodModel
      .countDocuments({ categoryId: new Types.ObjectId(id) })
      .exec();
    const subCategoryCount = await this.subCategoriesService.countByParentCategory(id);
    assertNoDependents(
      'category',
      { count: foodCount, label: 'products' },
      { count: subCategoryCount, label: 'sub-categories' },
    );

    await this.categoryModel
      .deleteOne({ _id: new Types.ObjectId(id), restaurantId: new Types.ObjectId(restaurant) })
      .exec();
    return this.byId(restaurant);
  }

  // ── Foods ────────────────────────────────────────────────────────────────

  private async getMoneyConfig(): Promise<MoneyCurrency> {
    const config = await this.configurationService.get();
    return {
      currency: config.currency,
      scale: config.currencyDecimalDigits,
    };
  }

  private moneyMinor(value: number | undefined, currencyConfig: MoneyCurrency): number | undefined {
    if (value === undefined) return undefined;
    return Money.fromDecimal(value, currencyConfig).toSafeMinorNumber();
  }

  private buildVariations(input: FoodInput, currencyConfig: MoneyCurrency) {
    return (input.variations ?? []).map((v) => ({
      _id: v._id ? new Types.ObjectId(v._id) : new Types.ObjectId(),
      title: v.title,
      price: v.price ?? 0,
      priceMinor: this.moneyMinor(v.price ?? 0, currencyConfig),
      discounted: v.discounted ?? 0,
      discountedMinor: this.moneyMinor(v.discounted ?? 0, currencyConfig),
      addons: v.addons ?? [],
      isOutOfStock: v.isOutOfStock ?? false,
    }));
  }

  async createFood(input: FoodInput): Promise<RestaurantDocument> {
    const currencyConfig = await this.getMoneyConfig();
    await this.foodModel.create({
      restaurantId: new Types.ObjectId(input.restaurant),
      categoryId: new Types.ObjectId(input.category),
      title: input.title,
      description: input.description,
      image: input.image,
      subCategory: input.subCategory,
      isActive: input.isActive ?? true,
      isOutOfStock: input.isOutOfStock ?? false,
      variations: this.buildVariations(input, currencyConfig),
    });
    return this.byId(input.restaurant);
  }

  async editFood(input: FoodInput): Promise<RestaurantDocument> {
    const currencyConfig = await this.getMoneyConfig();
    const patch: Record<string, unknown> = {
      title: input.title,
      variations: this.buildVariations(input, currencyConfig),
    };

    // Only overwrite optional fields the client actually sent, preserving the
    // partial-update semantics the embedded-array implementation had.
    if (Object.prototype.hasOwnProperty.call(input, 'description')) patch.description = input.description;
    if (Object.prototype.hasOwnProperty.call(input, 'image')) patch.image = input.image;
    if (Object.prototype.hasOwnProperty.call(input, 'subCategory')) patch.subCategory = input.subCategory;
    if (Object.prototype.hasOwnProperty.call(input, 'isActive')) patch.isActive = input.isActive;
    if (Object.prototype.hasOwnProperty.call(input, 'isOutOfStock')) patch.isOutOfStock = input.isOutOfStock;

    await this.foodModel
      .updateOne(
        { _id: new Types.ObjectId(input._id!), categoryId: new Types.ObjectId(input.category) },
        { $set: patch },
      )
      .exec();
    return this.byId(input.restaurant);
  }

  async deleteFood(
    id: string,
    restaurant: string,
    categoryId: string,
  ): Promise<RestaurantDocument> {
    await this.foodModel
      .deleteOne({ _id: new Types.ObjectId(id), categoryId: new Types.ObjectId(categoryId) })
      .exec();
    return this.byId(restaurant);
  }

  async updateFoodOutOfStock(id: string, restaurant: string, categoryId: string): Promise<boolean> {
    const food = await this.foodModel
      .findOne({ _id: new Types.ObjectId(id), categoryId: new Types.ObjectId(categoryId) })
      .lean()
      .exec();
    if (!food) return false;

    const newStock = !food.isOutOfStock;
    await this.foodModel
      .updateOne({ _id: new Types.ObjectId(id) }, { $set: { isOutOfStock: newStock } })
      .exec();

    await this.pubSub.publish(Events.FOOD_STOCK_CHANGED, {
      [Events.FOOD_STOCK_CHANGED]: {
        restaurantId: restaurant,
        categoryId,
        foodId: id,
        isOutOfStock: newStock,
      },
    });

    return true;
  }

  // ── Options ──────────────────────────────────────────────────────────────

  async createOptions(input: CreateOptionInput): Promise<RestaurantDocument> {
    const currencyConfig = await this.getMoneyConfig();
    const docs = input.options.map((opt: OptionItemInput) => ({
      restaurantId: new Types.ObjectId(input.restaurant),
      title: opt.title,
      description: opt.description,
      price: opt.price ?? 0,
      priceMinor: this.moneyMinor(opt.price ?? 0, currencyConfig),
    }));
    await this.optionModel.insertMany(docs);
    return this.byId(input.restaurant);
  }

  async editOption(input: EditOptionInput): Promise<RestaurantDocument> {
    const currencyConfig = await this.getMoneyConfig();
    const patch: Record<string, unknown> = {};
    if (input.title !== undefined) patch.title = input.title;
    if (input.description !== undefined) patch.description = input.description;
    if (input.price !== undefined) {
      patch.price = input.price;
      patch.priceMinor = this.moneyMinor(input.price, currencyConfig);
    }

    await this.optionModel
      .updateOne(
        { _id: new Types.ObjectId(input._id), restaurantId: new Types.ObjectId(input.restaurant) },
        { $set: patch },
      )
      .exec();
    return this.byId(input.restaurant);
  }

  async deleteOption(id: string, restaurant: string): Promise<RestaurantDocument> {
    await this.optionModel
      .deleteOne({ _id: new Types.ObjectId(id), restaurantId: new Types.ObjectId(restaurant) })
      .exec();
    return this.byId(restaurant);
  }

  // ── Addons ───────────────────────────────────────────────────────────────

  async createAddons(input: AddonInput): Promise<RestaurantDocument> {
    const docs = input.addons.map((item: AddonItemInput) => ({
      restaurantId: new Types.ObjectId(input.restaurant),
      title: item.title,
      description: item.description,
      quantityMinimum: item.quantityMinimum ?? 0,
      quantityMaximum: item.quantityMaximum ?? 1,
      options: item.options ?? [],
    }));
    await this.addonModel.insertMany(docs);
    return this.byId(input.restaurant);
  }

  async editAddon(input: EditAddonInput): Promise<RestaurantDocument> {
    const item = input.addons;
    const patch: Record<string, unknown> = {};
    if (item.title !== undefined) patch.title = item.title;
    if (item.description !== undefined) patch.description = item.description;
    if (item.quantityMinimum !== undefined) patch.quantityMinimum = item.quantityMinimum;
    if (item.quantityMaximum !== undefined) patch.quantityMaximum = item.quantityMaximum;
    if (item.options !== undefined) patch.options = item.options;

    await this.addonModel
      .updateOne(
        { _id: new Types.ObjectId(item._id), restaurantId: new Types.ObjectId(input.restaurant) },
        { $set: patch },
      )
      .exec();
    return this.byId(input.restaurant);
  }

  async deleteAddon(id: string, restaurant: string): Promise<RestaurantDocument> {
    await this.addonModel
      .deleteOne({ _id: new Types.ObjectId(id), restaurantId: new Types.ObjectId(restaurant) })
      .exec();
    return this.byId(restaurant);
  }

  // ── Catalog read API (field resolvers + cross-domain consumers) ───────────

  /**
   * Categories for a restaurant, each with its foods attached under `foods`.
   * Resolves the whole menu in two queries (categories + foods) regardless of
   * category count, so the `Restaurant.categories { foods }` field resolver
   * never fans out per-category.
   */
  async categoriesWithFoodsForRestaurant(restaurantId: string): Promise<any[]> {
    const rid = new Types.ObjectId(restaurantId);
    const [categories, foods] = await Promise.all([
      this.categoryModel.find({ restaurantId: rid }).lean().exec(),
      this.foodModel.find({ restaurantId: rid }).lean().exec(),
    ]);

    const foodsByCategory = new Map<string, any[]>();
    for (const food of foods) {
      const key = String(food.categoryId);
      const bucket = foodsByCategory.get(key);
      if (bucket) bucket.push(food);
      else foodsByCategory.set(key, [food]);
    }

    return categories.map((cat) => ({
      ...cat,
      foods: foodsByCategory.get(String(cat._id)) ?? [],
    }));
  }

  optionsForRestaurant(restaurantId: string): Promise<any[]> {
    return this.optionModel
      .find({ restaurantId: new Types.ObjectId(restaurantId) })
      .lean()
      .exec();
  }

  addonsForRestaurant(restaurantId: string): Promise<any[]> {
    return this.addonModel
      .find({ restaurantId: new Types.ObjectId(restaurantId) })
      .lean()
      .exec();
  }

  /**
   * Snapshot of the foods/addons/options a single restaurant needs during order
   * placement. Replaces Orders reaching into the embedded restaurant menu.
   */
  async getOrderPlacementCatalog(
    restaurantId: string,
  ): Promise<{ foods: any[]; addons: any[]; options: any[] }> {
    const rid = new Types.ObjectId(restaurantId);
    const [foods, addons, options] = await Promise.all([
      this.foodModel.find({ restaurantId: rid }).lean().exec(),
      this.addonModel.find({ restaurantId: rid }).lean().exec(),
      this.optionModel.find({ restaurantId: rid }).lean().exec(),
    ]);
    return { foods, addons, options };
  }

  /** Food ids belonging to the given categories — used by ITEMS-scoped offers. */
  async getFoodIdsForCategories(
    restaurantId: string,
    categoryIds: string[],
  ): Promise<string[]> {
    if (!categoryIds.length) return [];
    const foods = await this.foodModel
      .find(
        {
          restaurantId: new Types.ObjectId(restaurantId),
          categoryId: { $in: categoryIds.map((id) => new Types.ObjectId(id)) },
        },
        '_id',
      )
      .lean()
      .exec();
    return foods.map((f) => String(f._id));
  }

  /** Count of foods still referencing a sub-category (by id or title). */
  async countFoodsUsingSubCategory(matchValues: string[]): Promise<number> {
    if (!matchValues.length) return 0;
    return this.foodModel.countDocuments({ subCategory: { $in: matchValues } }).exec();
  }

  // ── Public discovery queries ─────────────────────────────────────────────

  async popularFoodItems(restaurantId: string) {
    return this.foodModel
      .find({ restaurantId: new Types.ObjectId(restaurantId) })
      .limit(20)
      .lean()
      .exec();
  }

  async popularItems(restaurantId: string) {
    const foods = await this.foodModel
      .find({ restaurantId: new Types.ObjectId(restaurantId) }, '_id')
      .lean()
      .exec();
    return foods.map((food) => ({ id: String(food._id), count: 0 }));
  }

  async relatedItems(itemId: string, restaurantId: string): Promise<string[]> {
    const foods = await this.foodModel
      .find({ restaurantId: new Types.ObjectId(restaurantId) }, '_id')
      .lean()
      .exec();
    return foods
      .map((food) => String(food._id))
      .filter((id) => id !== itemId)
      .slice(0, 10);
  }

  async fetchCategoryDetailsByStoreIdForMobile(storeId: string) {
    const categories = await this.categoriesWithFoodsForRestaurant(storeId);
    return categories.map((cat) => {
      const firstFood = cat.foods?.[0];
      return {
        id: String(cat._id),
        category_name: cat.title ?? '',
        url: cat.image,
        food_id: firstFood ? String(firstFood._id) : undefined,
      };
    });
  }

  async fetchCategoryDetailsByStoreId(storeId: string) {
    const categories = await this.categoriesWithFoodsForRestaurant(storeId);
    return categories.map((cat) => ({
      id: String(cat._id),
      label: cat.title,
      url: cat.image,
      items: (cat.foods ?? []).map((f: any) => ({
        id: String(f._id),
        label: f.title,
        url: f.image,
      })),
    }));
  }
}
