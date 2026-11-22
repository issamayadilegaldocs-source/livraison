import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AuditLog, AuditLogDocument } from './audit.schema';

@Injectable()
export class AuditService {
  constructor(
    @InjectModel(AuditLog.name)
    private readonly auditModel: Model<AuditLogDocument>,
  ) {}

  async create(
    adminId: string,
    adminEmail: string,
    action: string,
    targetType: string,
    targetId: string,
    changes?: string,
  ): Promise<void> {
    await this.auditModel.create({
      timestamp: new Date(),
      admin: { _id: adminId, email: adminEmail },
      action,
      targetType,
      targetId,
      changes,
    });
  }

  async findPaginated(
    page = 1,
    limit = 20,
  ): Promise<{
    auditLogs: AuditLogDocument[];
    totalCount: number;
    currentPage: number;
    totalPages: number;
  }> {
    const skip = (page - 1) * limit;
    const [auditLogs, totalCount] = await Promise.all([
      this.auditModel
        .find()
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.auditModel.countDocuments().exec(),
    ]);
    const totalPages = Math.ceil(totalCount / limit);
    return { auditLogs, totalCount, currentPage: page, totalPages };
  }
}
