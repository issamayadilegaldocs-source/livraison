import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Banner, BannerDocument } from './banner.schema';
import { BannerInput } from './dto/banner.input';

@Injectable()
export class BannersService {
  constructor(
    @InjectModel(Banner.name)
    private readonly bannerModel: Model<BannerDocument>,
  ) {}

  findAll() {
    return this.bannerModel.find({ isActive: { $ne: false } }).sort({ sortOrder: 1, createdAt: -1 }).lean().exec();
  }

  async create(input: BannerInput): Promise<BannerDocument> {
    const created = new this.bannerModel({
      title: input.title,
      description: input.description,
      action: input.action,
      file: input.file,
      badgeText: input.badgeText,
      buttonText: input.buttonText,
      promoCode: input.promoCode,
      backgroundColor: input.backgroundColor,
      textColor: input.textColor,
      accentColor: input.accentColor,
      buttonBackgroundColor: input.buttonBackgroundColor,
      buttonTextColor: input.buttonTextColor,
      sortOrder: input.sortOrder ?? 0,
      isActive: input.isActive ?? true,
      screen: input.screen,
      parameters: input.parameters,
    });
    return created.save();
  }

  async edit(input: BannerInput): Promise<BannerDocument> {
    const patch = Object.fromEntries(
      Object.entries({
        title: input.title,
        description: input.description,
        action: input.action,
        file: input.file,
        badgeText: input.badgeText,
        buttonText: input.buttonText,
        promoCode: input.promoCode,
        backgroundColor: input.backgroundColor,
        textColor: input.textColor,
        accentColor: input.accentColor,
        buttonBackgroundColor: input.buttonBackgroundColor,
        buttonTextColor: input.buttonTextColor,
        sortOrder: input.sortOrder,
        isActive: input.isActive,
        screen: input.screen,
        parameters: input.parameters,
      }).filter(([, v]) => v !== undefined),
    );

    const updated = await this.bannerModel
      .findByIdAndUpdate(input._id, { $set: patch }, { new: true })
      .lean()
      .exec();

    if (!updated) throw new NotFoundException(`Banner ${input._id} not found`);
    return updated as BannerDocument;
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.bannerModel.findByIdAndDelete(id).exec();
    return result !== null;
  }
}
