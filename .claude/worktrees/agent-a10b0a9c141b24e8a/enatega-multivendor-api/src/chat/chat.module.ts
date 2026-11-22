import { Module } from '@nestjs/common';
import { SecurityModule } from '../auth/security.module';
import { ChatResolver } from './chat.resolver';

@Module({
  imports: [SecurityModule],
  providers: [ChatResolver],
})
export class ChatModule {}
