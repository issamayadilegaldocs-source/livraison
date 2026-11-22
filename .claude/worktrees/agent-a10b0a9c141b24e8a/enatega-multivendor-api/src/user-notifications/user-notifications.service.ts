import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { UserNotification, UserNotificationDocument } from './user-notification.schema';

@Injectable()
export class UserNotificationsService {
  constructor(
    @InjectModel(UserNotification.name)
    private readonly model: Model<UserNotificationDocument>,
  ) {}

  create(
    userId: string,
    title: string,
    body: string,
    type = 'SYSTEM',
    data?: Record<string, string>,
  ): Promise<UserNotificationDocument> {
    return this.model.create({ userId, title, body, type, data, isRead: false });
  }

  async findForUser(userId: string, limit = 30) {
    const docs = await this.model
      .find({ userId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean()
      .exec();
    return docs.map((d: any) => ({
      ...d,
      _id: String(d._id),
      dataJson: d.data ? JSON.stringify(d.data) : undefined,
    }));
  }

  countUnread(userId: string): Promise<number> {
    return this.model.countDocuments({ userId, isRead: false }).exec();
  }

  async markRead(userId: string, ids: string[]): Promise<number> {
    const result = await this.model
      .updateMany({ _id: { $in: ids }, userId }, { $set: { isRead: true } })
      .exec();
    return result.modifiedCount;
  }

  async markAllRead(userId: string): Promise<number> {
    const result = await this.model
      .updateMany({ userId, isRead: false }, { $set: { isRead: true } })
      .exec();
    return result.modifiedCount;
  }
}
