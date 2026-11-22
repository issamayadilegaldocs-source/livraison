import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NotificationsModule } from '../notifications/notifications.module';
import { CloudinaryProvider } from '../providers/cloudinary.provider';
import { UploadService } from './upload.service';
import { UploadsResolver } from './uploads.resolver';

@Module({
  imports: [ConfigModule, NotificationsModule],
  providers: [CloudinaryProvider, UploadService, UploadsResolver],
  exports: [UploadService],
})
export class UploadsModule {}
