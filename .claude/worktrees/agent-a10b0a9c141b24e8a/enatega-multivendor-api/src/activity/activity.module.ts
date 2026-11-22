import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SecurityModule } from '../auth/security.module';
import { Activity, ActivitySchema } from './activity.schema';
import { ActivityService } from './activity.service';
import { ActivityResolver } from './activity.resolver';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Activity.name, schema: ActivitySchema }]),
    SecurityModule,
  ],
  providers: [ActivityService, ActivityResolver],
})
export class ActivityModule {}
