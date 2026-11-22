import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Zone, ZoneDocument } from './zone.schema';
import { Rider, RiderDocument } from '../riders/rider.schema';
import { ZoneInput } from './dto/zone.input';
import { assertNoDependents } from '../common/referential-integrity.util';

@Injectable()
export class ZonesService {
  constructor(
    @InjectModel(Zone.name) private readonly zoneModel: Model<ZoneDocument>,
    @InjectModel(Rider.name) private readonly riderModel: Model<RiderDocument>,
  ) {}

  findAll() {
    return this.zoneModel.find().lean().exec();
  }

  findById(id: string) {
    return this.zoneModel.findById(id).lean().exec();
  }

  /**
   * Find the active zone whose polygon contains the given geographic point.
   * Relies on the `location` 2dsphere index for an efficient $geoIntersects.
   */
  findByPoint(longitude: number, latitude: number) {
    return this.zoneModel
      .findOne({
        isActive: true,
        location: {
          $geoIntersects: {
            $geometry: { type: 'Point', coordinates: [longitude, latitude] },
          },
        },
      })
      .lean()
      .exec();
  }

  async create(input: ZoneInput): Promise<ZoneDocument> {
    const created = new this.zoneModel({
      title: input.title,
      description: input.description,
      location: input.location
        ? { type: 'Polygon', coordinates: input.location.coordinates }
        : undefined,
      isActive: input.isActive ?? true,
    });
    return created.save();
  }

  async edit(input: ZoneInput): Promise<ZoneDocument> {
    const patch: Partial<Zone> & { location?: unknown } = {};
    if (input.title !== undefined) patch.title = input.title;
    if (input.description !== undefined) patch.description = input.description;
    if (input.isActive !== undefined) patch.isActive = input.isActive;
    if (input.location !== undefined) {
      patch.location = { type: 'Polygon', coordinates: input.location.coordinates };
    }

    const updated = await this.zoneModel
      .findByIdAndUpdate(input._id, { $set: patch }, { new: true })
      .lean()
      .exec();

    if (!updated) throw new NotFoundException(`Zone ${input._id} not found`);
    return updated as ZoneDocument;
  }

  async delete(id: string): Promise<ZoneDocument> {
    // Referential integrity: a zone in use by restaurants or riders must not be
    // deleted — doing so would break their delivery-area assignment.
    const zoneId = new Types.ObjectId(id);
    const riderCount = await this.riderModel.countDocuments({ zone: zoneId }).exec();
    assertNoDependents(
      'zone',
      { count: riderCount, label: 'riders' },
    );

    const deleted = await this.zoneModel.findByIdAndDelete(id).lean().exec();
    if (!deleted) throw new NotFoundException(`Zone ${id} not found`);
    return deleted as ZoneDocument;
  }
}
