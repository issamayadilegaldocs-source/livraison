import { UseGuards } from '@nestjs/common';
import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '../auth/roles.enum';
import {
  SupportTicketModel,
  TicketMessageModel,
  TicketUsersWithLatestResultModel,
  TicketUsersResultModel,
  SupportTicketsResultModel,
  TicketMessagesResultModel,
} from './support-ticket.model';
import { SupportTicketsService } from './support-tickets.service';
import {
  FiltersInput,
  SingleUserSupportTicketsInput,
  TicketMessagesInput,
  MessageInput,
  UpdateSupportTicketInput,
} from './dto/support-ticket.input';

@UseGuards(ClerkAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Resolver()
export class SupportTicketsAdminResolver {
  constructor(private readonly supportTicketsService: SupportTicketsService) {}

  @Query(() => TicketUsersWithLatestResultModel, { name: 'getTicketUsersWithLatest' })
  getTicketUsersWithLatest(
    @Args('input', { type: () => FiltersInput, nullable: true }) input?: FiltersInput,
  ) {
    return this.supportTicketsService.getTicketUsersWithLatest(input ?? {});
  }

  @Query(() => TicketUsersResultModel, { name: 'getTicketUsers' })
  getTicketUsers(
    @Args('input', { type: () => FiltersInput, nullable: true }) input?: FiltersInput,
  ) {
    return this.supportTicketsService.getTicketUsers(input ?? {});
  }

  @Query(() => SupportTicketsResultModel, { name: 'getSingleUserSupportTickets' })
  getSingleUserSupportTickets(
    @Args('input') input: SingleUserSupportTicketsInput,
  ) {
    return this.supportTicketsService.getSingleUserSupportTickets(input);
  }

  @Query(() => SupportTicketModel, { name: 'getSingleSupportTicket' })
  getSingleSupportTicket(
    @Args('ticketId', { type: () => ID }) ticketId: string,
  ) {
    return this.supportTicketsService.getSingleSupportTicket(ticketId);
  }

  @Query(() => TicketMessagesResultModel, { name: 'getTicketMessages' })
  getTicketMessages(@Args('input') input: TicketMessagesInput) {
    return this.supportTicketsService.getTicketMessages(input);
  }

  @Mutation(() => TicketMessageModel, { name: 'createAdminMessage' })
  createAdminMessage(@Args('messageInput') messageInput: MessageInput) {
    return this.supportTicketsService.createMessage(messageInput, 'admin');
  }

  @Mutation(() => SupportTicketModel, { name: 'updateSupportTicketStatus' })
  updateSupportTicketStatus(@Args('input') input: UpdateSupportTicketInput) {
    return this.supportTicketsService.updateTicketStatus(input.ticketId, input.status);
  }
}
