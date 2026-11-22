import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SecurityModule } from '../auth/security.module';
import { AuditModule } from '../audit/audit.module';
import { Staff, StaffSchema } from './staff.schema';
import { StaffService } from './staff.service';
import { StaffAdminResolver } from './staff-admin.resolver';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Staff.name, schema: StaffSchema }]),
    SecurityModule,
    AuditModule,
  ],
  providers: [StaffService, StaffAdminResolver],
  exports: [StaffService],
})
export class StaffModule {}
