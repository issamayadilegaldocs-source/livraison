import { Field, InputType, Int } from '@nestjs/graphql';
import { IsOptional, IsString, IsInt, Min, IsNotEmpty } from 'class-validator';

@InputType('FiltersInput')
export class FiltersInput {
  @Field(() => Int, { nullable: true }) @IsOptional() @IsInt() @Min(1) page?: number;
  @Field(() => Int, { nullable: true }) @IsOptional() @IsInt() @Min(1) limit?: number;
  @Field({ nullable: true }) @IsOptional() @IsString() search?: string;
}

@InputType('SingleUserSupportTicketsInput')
export class SingleUserSupportTicketsInput {
  @Field() @IsNotEmpty() @IsString() userId!: string;
  @Field(() => Int, { nullable: true }) @IsOptional() @IsInt() @Min(1) page?: number;
  @Field(() => Int, { nullable: true }) @IsOptional() @IsInt() @Min(1) limit?: number;
}

@InputType('TicketMessagesInput')
export class TicketMessagesInput {
  @Field() @IsNotEmpty() @IsString() ticketId!: string;
  @Field(() => Int, { nullable: true }) @IsOptional() @IsInt() @Min(1) page?: number;
  @Field(() => Int, { nullable: true }) @IsOptional() @IsInt() @Min(1) limit?: number;
}

@InputType('SupportTicketInput')
export class SupportTicketInput {
  @Field() @IsNotEmpty() @IsString() title!: string;
  @Field() @IsNotEmpty() @IsString() description!: string;
  @Field() @IsNotEmpty() @IsString() category!: string;
  @Field({ nullable: true }) @IsOptional() @IsString() orderId?: string;
  @Field({ nullable: true }) @IsOptional() @IsString() otherDetails?: string;
}

@InputType('MessageInput')
export class MessageInput {
  @Field() @IsNotEmpty() @IsString() content!: string;
  @Field() @IsNotEmpty() @IsString() ticketId!: string;
  @Field({ nullable: true }) @IsOptional() @IsString() senderType?: string;
}

@InputType('UpdateSupportTicketInput')
export class UpdateSupportTicketInput {
  @Field() @IsNotEmpty() @IsString() ticketId!: string;
  @Field() @IsNotEmpty() @IsString() status!: string;
}
