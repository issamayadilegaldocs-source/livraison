import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Tipping, TippingDocument } from './tipping.schema';
import { TippingInput } from './dto/tipping.input';

@Injectable()
export class TippingsService {
  constructor(
    @InjectModel(Tipping.name)
    private readonly tippingModel: Model<TippingDocument>,
  ) {}

  // Tipping is a singleton config document; every frontend (admin form,
  // customer app cart/checkout, web checkout) reads it as a single object.
  findFirst(): Promise<TippingDocument | null> {
    return this.tippingModel.findOne().lean().exec() as Promise<TippingDocument | null>;
  }

  create(input: TippingInput): Promise<TippingDocument> {
    return this.tippingModel.create({
      tipVariations: input.tipVariations ?? [],
      enabled: input.enabled ?? true,
    });
  }

  async edit(input: TippingInput): Promise<TippingDocument> {
    if (!input._id) throw new BadRequestException('_id is required');
    const patch: Record<string, unknown> = {};
    if (input.tipVariations !== undefined) patch.tipVariations = input.tipVariations;
    if (input.enabled !== undefined) patch.enabled = input.enabled;

    const updated = await this.tippingModel
      .findByIdAndUpdate(input._id, { $set: patch }, { new: true })
      .lean()
      .exec();
    if (!updated) throw new NotFoundException('Tipping not found');
    return updated as TippingDocument;
  }
}
