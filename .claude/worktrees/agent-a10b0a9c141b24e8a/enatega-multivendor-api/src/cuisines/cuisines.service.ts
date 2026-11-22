import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Cuisine, CuisineDocument } from './cuisine.schema';
import { RestaurantsService } from '../restaurants/restaurants.service';
import { CuisineInput } from './dto/cuisine.input';
import { assertNoDependents } from '../common/referential-integrity.util';

@Injectable()
export class CuisinesService {
  constructor(
    @InjectModel(Cuisine.name)
    private readonly cuisineModel: Model<CuisineDocument>,
    private readonly restaurantsService: RestaurantsService,
  ) {}

  findAll() {
    return this.cuisineModel.find().lean().exec();
  }

  /** No shopType = all shop types — the web client fetches once and splits restaurant/grocery itself. */
  findByShopType(shopType?: string | null) {
    return this.cuisineModel
      .find(shopType ? { shopType } : {})
      .lean()
      .exec();
  }

  async create(input: CuisineInput): Promise<CuisineDocument> {
    const created = new this.cuisineModel({
      name: input.name,
      description: input.description,
      image: input.image,
      shopType: input.shopType,
    });
    return created.save();
  }

  async edit(input: CuisineInput): Promise<CuisineDocument> {
    const patch = Object.fromEntries(
      Object.entries({
        name: input.name,
        description: input.description,
        image: input.image,
        shopType: input.shopType,
      }).filter(([, v]) => v !== undefined),
    );

    const updated = await this.cuisineModel
      .findByIdAndUpdate(input._id, { $set: patch }, { new: true })
      .lean()
      .exec();

    if (!updated) throw new NotFoundException(`Cuisine ${input._id} not found`);
    return updated as CuisineDocument;
  }

  async delete(id: string): Promise<boolean> {
    const cuisine = await this.cuisineModel.findById(id).lean().exec();
    if (!cuisine) return false;

    // Referential integrity: block while restaurants still list this cuisine
    // (Restaurant.cuisines stores the cuisine name).
    const restaurantCount = await this.restaurantsService.countRestaurantsUsingCuisine(cuisine.name);
    assertNoDependents('cuisine', {
      count: restaurantCount,
      label: 'restaurants',
    });

    const result = await this.cuisineModel.findByIdAndDelete(id).exec();
    return result !== null;
  }
}
