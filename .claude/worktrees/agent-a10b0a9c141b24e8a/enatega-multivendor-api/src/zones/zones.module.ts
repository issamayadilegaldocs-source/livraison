import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Zone, ZoneSchema } from './zone.schema';
import { Rider, RiderSchema } from '../riders/rider.schema';
import { ZonesService } from './zones.service';
import { ZonesResolver } from './zones.resolver';
import { SecurityModule } from '../auth/security.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Zone.name, schema: ZoneSchema },
      { name: Rider.name, schema: RiderSchema },
    ]),
    SecurityModule,
  ],
  providers: [ZonesService, ZonesResolver],
  exports: [ZonesService],
})
export class ZonesModule {}
