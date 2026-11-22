import { Field, ID, Int, ObjectType } from '@nestjs/graphql';

@ObjectType('AuditAdminRef')
export class AuditAdminRefModel {
  @Field(() => ID, { nullable: true }) _id?: string;
  @Field({ nullable: true }) email?: string;
}

@ObjectType('AuditLog')
export class AuditLogModel {
  @Field(() => ID) _id!: string;
  @Field({ nullable: true }) timestamp?: string;
  @Field(() => AuditAdminRefModel, { nullable: true }) admin?: AuditAdminRefModel;
  @Field({ nullable: true }) action?: string;
  @Field({ nullable: true }) targetType?: string;
  @Field({ nullable: true }) targetId?: string;
  @Field({ nullable: true }) changes?: string;
}

@ObjectType('AuditLogsResult')
export class AuditLogsResultModel {
  @Field(() => [AuditLogModel]) auditLogs!: AuditLogModel[];
  @Field(() => Int) totalCount!: number;
  @Field(() => Int) currentPage!: number;
  @Field(() => Int) totalPages!: number;
}
