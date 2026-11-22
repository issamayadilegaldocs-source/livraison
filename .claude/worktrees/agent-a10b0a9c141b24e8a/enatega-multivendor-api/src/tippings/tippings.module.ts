import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SecurityModule } from '../auth/security.module';
import { Tipping, TippingSchema } from './tipping.schema';
import { TippingsService } from './tippings.service';
import { TippingsResolver } from './tippings.resolver';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Tipping.name, schema: TippingSchema }]),
    SecurityModule,
  ],
  providers: [TippingsService, TippingsResolver],
  exports: [TippingsService],
})
export class TippingsModule {}
