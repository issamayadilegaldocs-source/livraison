import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import * as bcrypt from 'bcryptjs';
import { Model } from 'mongoose';
import { Staff, StaffDocument } from './staff.schema';
import { StaffInput } from './dto/staff.input';

@Injectable()
export class StaffService {
  constructor(
    @InjectModel(Staff.name)
    private readonly staffModel: Model<StaffDocument>,
  ) {}

  findAll(): Promise<StaffDocument[]> {
    return this.staffModel.find().lean().exec() as Promise<StaffDocument[]>;
  }

  async create(input: StaffInput): Promise<StaffDocument> {
    if (!input.password) throw new BadRequestException('Password is required');
    const hashed = await bcrypt.hash(input.password, 12);
    return this.staffModel.create({
      name: input.name,
      email: input.email?.toLowerCase().trim(),
      password: hashed,
      phone: input.phone,
      isActive: input.isActive ?? true,
      permissions: input.permissions ?? [],
      userType: 'STAFF',
    });
  }

  async edit(input: StaffInput): Promise<StaffDocument> {
    if (!input._id) throw new BadRequestException('_id is required for edit');
    const patch: Record<string, unknown> = {};
    if (input.name !== undefined) patch.name = input.name;
    if (input.email !== undefined)
      patch.email = input.email.toLowerCase().trim();
    if (input.phone !== undefined) patch.phone = input.phone;
    if (input.isActive !== undefined) patch.isActive = input.isActive;
    if (input.permissions !== undefined) patch.permissions = input.permissions;
    if (input.password) {
      patch.password = await bcrypt.hash(input.password, 12);
    }
    const updated = await this.staffModel
      .findByIdAndUpdate(input._id, { $set: patch }, { new: true })
      .exec();
    if (!updated) throw new NotFoundException('Staff not found');
    return updated;
  }

  async delete(id: string): Promise<StaffDocument> {
    const deleted = await this.staffModel.findByIdAndDelete(id).exec();
    if (!deleted) throw new NotFoundException('Staff not found');
    return deleted;
  }
}
