import { forwardRef, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { SubCategory, SubCategoryDocument } from './sub-category.schema';
import { CatalogService } from '../restaurants/catalog.service';
import { SubCategoryInput } from './dto/sub-category.input';
import { assertNoDependents } from '../common/referential-integrity.util';

@Injectable()
export class SubCategoriesService {
  constructor(
    @InjectModel(SubCategory.name)
    private readonly subCategoryModel: Model<SubCategoryDocument>,
    // forwardRef: CatalogService depends on SubCategoriesService (category
    // delete guard) and vice-versa (sub-category delete guard), a deliberate
    // bidirectional referential-integrity cycle between the two capabilities.
    @Inject(forwardRef(() => CatalogService))
    private readonly catalogService: CatalogService,
  ) {}

  findAll() {
    return this.subCategoryModel.find().lean().exec();
  }

  async findById(id: string) {
    const doc = await this.subCategoryModel.findById(id).lean().exec();
    if (!doc) throw new NotFoundException(`SubCategory ${id} not found`);
    return doc;
  }

  findByParentId(parentCategoryId?: string) {
    if (!parentCategoryId) return [];
    return this.subCategoryModel.find({ parentCategoryId }).lean().exec();
  }

  countByParentCategory(parentCategoryId: string): Promise<number> {
    return this.subCategoryModel.countDocuments({ parentCategoryId }).exec();
  }

  async createMany(inputs: SubCategoryInput[]): Promise<boolean> {
    await this.subCategoryModel.insertMany(inputs);
    return true;
  }

  async delete(id: string): Promise<boolean> {
    const sub = await this.subCategoryModel.findById(id).lean().exec();
    if (!sub) return false;

    // Referential integrity: block while products still reference this
    // sub-category. Foods store `subCategory` as a free string, which may be
    // either the sub-category id or its title, so match on both.
    const matchValues = [id, sub.title].filter(Boolean);
    const productCount = await this.catalogService.countFoodsUsingSubCategory(matchValues);
    assertNoDependents('sub-category', {
      count: productCount,
      label: 'products',
    });

    const result = await this.subCategoryModel.findByIdAndDelete(id).exec();
    return result !== null;
  }
}
