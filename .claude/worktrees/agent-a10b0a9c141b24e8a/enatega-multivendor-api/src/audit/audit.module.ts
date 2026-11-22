import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SecurityModule } from '../auth/security.module';
import { AuditLog, AuditLogSchema } from './audit.schema';
import { AuditService } from './audit.service';
import { AuditResolver } from './audit.resolver';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: AuditLog.name, schema: AuditLogSchema },
    ]),
    SecurityModule,
  ],
  providers: [AuditService, AuditResolver],
  exports: [AuditService],
})
export class AuditModule {}
