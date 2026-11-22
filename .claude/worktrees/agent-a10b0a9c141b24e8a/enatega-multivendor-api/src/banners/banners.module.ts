import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Banner, BannerSchema } from './banner.schema';
import { BannersService } from './banners.service';
import { BannersResolver } from './banners.resolver';
import { SecurityModule } from '../auth/security.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Banner.name, schema: BannerSchema }]),
    SecurityModule,
  ],
  providers: [BannersService, BannersResolver],
  exports: [BannersService],
})
export class BannersModule {}
