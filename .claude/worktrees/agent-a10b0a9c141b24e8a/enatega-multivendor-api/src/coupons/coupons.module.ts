import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SecurityModule } from '../auth/security.module';
import { AuditModule } from '../audit/audit.module';
import { Coupon, CouponSchema } from './coupon.schema';
import { CouponsService } from './coupons.service';
import { CouponsAdminResolver } from './coupons-admin.resolver';
import { CouponsResolver } from './coupons.resolver';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Coupon.name, schema: CouponSchema }]),
    SecurityModule,
    AuditModule,
  ],
  providers: [CouponsService, CouponsAdminResolver, CouponsResolver],
  exports: [CouponsService],
})
export class CouponsModule {}
