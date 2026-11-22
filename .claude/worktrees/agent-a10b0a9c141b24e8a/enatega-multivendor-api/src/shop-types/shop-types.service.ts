import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ShopType, ShopTypeDocument } from './shop-type.schema';
import { RestaurantsService } from '../restaurants/restaurants.service';
import {
  CreateShopTypeInput,
  DeleteTypeEnum,
  FetchShopTypeFilter,
  FetchUniqueShopTypeInput,
  UpdateShopTypeInput,
} from './dto/shop-type.input';
import { PaginationInput } from '../common/dto/pagination.input';
import { assertNoDependents } from '../common/referential-integrity.util';

@Injectable()
export class ShopTypesService {
  constructor(
    @InjectModel(ShopType.name)
    private readonly shopTypeModel: Model<ShopTypeDocument>,
    private readonly restaurantsService: RestaurantsService,
  ) {}

  async findPaginated(
    filter?: FetchShopTypeFilter,
    pagination?: PaginationInput,
  ) {
    const query: Record<string, unknown> = {};
    if (filter?.isActive !== undefined) query.isActive = filter.isActive;
    if (filter?.name) query.name = { $regex: filter.name, $options: 'i' };

    const page = Math.max(1, pagination?.page ?? 1);
    const pageSize = Math.max(1, pagination?.pageSize ?? 10);
    const skip = (page - 1) * pageSize;

    const [data, total] = await Promise.all([
      this.shopTypeModel.find(query).skip(skip).limit(pageSize).lean().exec(),
      this.shopTypeModel.countDocuments(query).exec(),
    ]);

    const totalPages = Math.ceil(total / pageSize);

    return {
      data,
      total,
      page,
      pageSize,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    };
  }

  async findByUnique(dto: FetchUniqueShopTypeInput): Promise<ShopTypeDocument> {
    const filter = dto._id ? { _id: dto._id } : { slug: dto.slug };
    const doc = await this.shopTypeModel.findOne(filter).lean().exec();
    if (!doc) throw new NotFoundException('ShopType not found');
    return doc as ShopTypeDocument;
  }

  findAll() {
    return this.shopTypeModel.find({ isActive: true }).lean().exec();
  }

  // Lowercase kebab-case slug; the customer app filters restaurants by this slug.
  private slugify(value: string): string {
    return value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  async create(dto: CreateShopTypeInput): Promise<ShopTypeDocument> {
    const slug = dto.slug?.trim() || this.slugify(dto.name);
    const created = new this.shopTypeModel({ ...dto, slug });
    return created.save();
  }

  async update(dto: UpdateShopTypeInput): Promise<ShopTypeDocument> {
    // Keep slug in sync when the name changes and no explicit slug was provided.
    const slug =
      dto.slug?.trim() || (dto.name ? this.slugify(dto.name) : undefined);
    const patch = Object.fromEntries(
      Object.entries({
        name: dto.name,
        image: dto.image,
        slug,
        isActive: dto.isActive,
      }).filter(([, v]) => v !== undefined),
    );

    const updated = await this.shopTypeModel
      .findByIdAndUpdate(dto._id, { $set: patch }, { new: true })
      .lean()
      .exec();

    if (!updated) throw new NotFoundException(`ShopType ${dto._id} not found`);
    return updated as ShopTypeDocument;
  }

  async delete(id: string, type?: DeleteTypeEnum): Promise<ShopTypeDocument> {
    if (type === DeleteTypeEnum.HARD) {
      // Referential integrity: block permanent deletion while restaurants still
      // reference this shop type (Restaurant.shopCategory matches its slug).
      // Soft delete (deactivate) below stays allowed for retiring a type.
      const shopType = await this.shopTypeModel.findById(id).lean().exec();
      if (!shopType) throw new NotFoundException(`ShopType ${id} not found`);
      const restaurantCount = shopType.slug
        ? await this.restaurantsService.countRestaurantsUsingShopCategory(shopType.slug)
        : 0;
      assertNoDependents('shop type', {
        count: restaurantCount,
        label: 'restaurants',
      });

      const deleted = await this.shopTypeModel.findByIdAndDelete(id).lean().exec();
      if (!deleted) throw new NotFoundException(`ShopType ${id} not found`);
      return deleted as ShopTypeDocument;
    }

    const updated = await this.shopTypeModel
      .findByIdAndUpdate(id, { $set: { isActive: false } }, { new: true })
      .lean()
      .exec();

    if (!updated) throw new NotFoundException(`ShopType ${id} not found`);
    return updated as ShopTypeDocument;
  }
}
