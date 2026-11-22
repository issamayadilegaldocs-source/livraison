import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SupportTicket, SupportTicketSchema } from './support-ticket.schema';
import { TicketMessage, TicketMessageSchema } from './ticket-message.schema';
import { SupportTicketsService } from './support-tickets.service';
import { SupportTicketsResolver } from './support-tickets.resolver';
import { SupportTicketsAdminResolver } from './support-tickets-admin.resolver';
import { SecurityModule } from '../auth/security.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: SupportTicket.name, schema: SupportTicketSchema },
      { name: TicketMessage.name, schema: TicketMessageSchema },
    ]),
    SecurityModule,
  ],
  providers: [SupportTicketsService, SupportTicketsResolver, SupportTicketsAdminResolver],
})
export class SupportTicketsModule {}
