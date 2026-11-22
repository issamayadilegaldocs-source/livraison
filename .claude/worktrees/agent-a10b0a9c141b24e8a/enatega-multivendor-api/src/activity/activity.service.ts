import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Activity, ActivityDocument } from './activity.schema';

@Injectable()
export class ActivityService {
  constructor(
    @InjectModel(Activity.name)
    private readonly activityModel: Model<ActivityDocument>,
  ) {}

  async create(
    userId: string | undefined,
    groupId: string,
    module: string,
    screenPath: string,
    type: string,
    details: string,
  ): Promise<string> {
    const doc = await this.activityModel.create({ userId, groupId, module, screenPath, type, details });
    return String(doc._id);
  }
}
