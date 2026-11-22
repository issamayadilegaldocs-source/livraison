import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SecurityModule } from '../auth/security.module';
import { Taxation, TaxationSchema } from './taxation.schema';
import { TaxationsService } from './taxations.service';
import { TaxationsResolver } from './taxations.resolver';
import { TaxationsPublicResolver } from './taxations-public.resolver';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Taxation.name, schema: TaxationSchema }]),
    SecurityModule,
  ],
  providers: [TaxationsService, TaxationsResolver, TaxationsPublicResolver],
  exports: [TaxationsService],
})
export class TaxationsModule {}
