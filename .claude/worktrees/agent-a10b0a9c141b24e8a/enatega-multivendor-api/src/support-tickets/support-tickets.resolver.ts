import { UseGuards } from '@nestjs/common';
import { Args, Mutation, Resolver } from '@nestjs/graphql';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { Role, JwtUser } from '../auth/roles.enum';
import { SupportTicketModel, TicketMessageModel } from './support-ticket.model';
import { SupportTicketsService } from './support-tickets.service';
import { SupportTicketInput, MessageInput } from './dto/support-ticket.input';

@UseGuards(ClerkAuthGuard, RolesGuard)
@Resolver()
export class SupportTicketsResolver {
  constructor(private readonly supportTicketsService: SupportTicketsService) {}

  @Roles(Role.CUSTOMER)
  @Mutation(() => SupportTicketModel, { name: 'createSupportTicket' })
  createSupportTicket(
    @CurrentUser() jwt: JwtUser,
    @Args('ticketInput') ticketInput: SupportTicketInput,
  ) {
    return this.supportTicketsService.createTicket(jwt.userId, ticketInput);
  }

  @Roles(Role.CUSTOMER, Role.ADMIN)
  @Mutation(() => TicketMessageModel, { name: 'createMessage' })
  createMessage(
    @CurrentUser() jwt: JwtUser,
    @Args('messageInput') messageInput: MessageInput,
  ) {
    const senderType = jwt.role === Role.ADMIN ? 'admin' : 'user';
    return this.supportTicketsService.createMessage(messageInput, senderType);
  }
}
