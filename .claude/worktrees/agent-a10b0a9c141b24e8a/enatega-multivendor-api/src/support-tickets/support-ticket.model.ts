import { Field, ID, Int, ObjectType } from '@nestjs/graphql';

@ObjectType('TicketUser')
export class TicketUserModel {
  @Field(() => ID) _id!: string;
  @Field({ nullable: true }) name?: string;
  @Field({ nullable: true }) email?: string;
  @Field({ nullable: true }) phone?: string;
  @Field({ nullable: true }) isActive?: boolean;
  @Field({ nullable: true }) userType?: string;
}

@ObjectType('SupportTicketType')
export class SupportTicketModel {
  @Field(() => ID) _id!: string;
  @Field({ nullable: true }) title?: string;
  @Field({ nullable: true }) description?: string;
  @Field({ nullable: true }) status?: string;
  @Field({ nullable: true }) category?: string;
  @Field({ nullable: true }) orderId?: string;
  @Field({ nullable: true }) otherDetails?: string;
  @Field(() => TicketUserModel, { nullable: true }) user?: TicketUserModel;
  @Field({ nullable: true }) createdAt?: string;
  @Field({ nullable: true }) updatedAt?: string;
}

@ObjectType('TicketMessage')
export class TicketMessageModel {
  @Field(() => ID) _id!: string;
  @Field({ nullable: true }) content?: string;
  @Field({ nullable: true }) senderType?: string;
  @Field({ nullable: true }) isRead?: boolean;
  @Field({ nullable: true }) ticket?: string;
  @Field({ nullable: true }) createdAt?: string;
  @Field({ nullable: true }) updatedAt?: string;
}

@ObjectType('TicketUserWithLatest')
export class TicketUserWithLatestModel {
  @Field(() => ID) _id!: string;
  @Field({ nullable: true }) name?: string;
  @Field({ nullable: true }) email?: string;
  @Field({ nullable: true }) phone?: string;
  @Field({ nullable: true }) isActive?: boolean;
  @Field({ nullable: true }) userType?: string;
  @Field(() => SupportTicketModel, { nullable: true }) latestTicket?: SupportTicketModel;
}

@ObjectType('TicketUsersWithLatestResult')
export class TicketUsersWithLatestResultModel {
  @Field(() => [TicketUserWithLatestModel]) users!: TicketUserWithLatestModel[];
  @Field(() => Int, { nullable: true }) docsCount?: number;
  @Field(() => Int, { nullable: true }) totalPages?: number;
  @Field(() => Int, { nullable: true }) currentPage?: number;
}

@ObjectType('TicketUsersResult')
export class TicketUsersResultModel {
  @Field(() => [TicketUserModel]) users!: TicketUserModel[];
  @Field(() => Int, { nullable: true }) docsCount?: number;
  @Field(() => Int, { nullable: true }) totalPages?: number;
  @Field(() => Int, { nullable: true }) currentPage?: number;
}

@ObjectType('SupportTicketsResult')
export class SupportTicketsResultModel {
  @Field(() => [SupportTicketModel]) tickets!: SupportTicketModel[];
  @Field(() => Int, { nullable: true }) docsCount?: number;
  @Field(() => Int, { nullable: true }) totalPages?: number;
  @Field(() => Int, { nullable: true }) currentPage?: number;
}

@ObjectType('TicketSummary')
export class TicketSummaryModel {
  @Field(() => ID) _id!: string;
  @Field({ nullable: true }) title?: string;
  @Field({ nullable: true }) status?: string;
  @Field(() => TicketUserModel, { nullable: true }) user?: TicketUserModel;
}

@ObjectType('TicketMessagesResult')
export class TicketMessagesResultModel {
  @Field(() => [TicketMessageModel]) messages!: TicketMessageModel[];
  @Field(() => TicketSummaryModel, { nullable: true }) ticket?: TicketSummaryModel;
  @Field(() => Int, { nullable: true }) page?: number;
  @Field(() => Int, { nullable: true }) totalPages?: number;
  @Field(() => Int, { nullable: true }) docsCount?: number;
}
