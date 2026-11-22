import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Taxation, TaxationDocument } from './taxation.schema';
import { TaxationInput } from './dto/taxation.input';

@Injectable()
export class TaxationsService {
  constructor(
    @InjectModel(Taxation.name)
    private readonly taxationModel: Model<TaxationDocument>,
  ) {}

  findAll(): Promise<TaxationDocument[]> {
    return this.taxationModel.find().lean().exec() as Promise<TaxationDocument[]>;
  }

  create(input: TaxationInput): Promise<TaxationDocument> {
    return this.taxationModel.create({
      taxationCharges: input.taxationCharges ?? 0,
      enabled: input.enabled ?? true,
    });
  }

  async edit(input: TaxationInput): Promise<TaxationDocument> {
    if (!input._id) throw new BadRequestException('_id is required');
    const patch: Record<string, unknown> = {};
    if (input.taxationCharges !== undefined) patch.taxationCharges = input.taxationCharges;
    if (input.enabled !== undefined) patch.enabled = input.enabled;

    const updated = await this.taxationModel
      .findByIdAndUpdate(input._id, { $set: patch }, { new: true })
      .lean()
      .exec();
    if (!updated) throw new NotFoundException('Taxation not found');
    return updated as TaxationDocument;
  }
}
