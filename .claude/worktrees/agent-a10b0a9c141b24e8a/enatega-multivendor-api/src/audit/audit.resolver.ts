import { UseGuards } from '@nestjs/common';
import { Args, Int, Query, Resolver } from '@nestjs/graphql';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '../auth/roles.enum';
import { AuditLogsResultModel } from './audit.model';
import { AuditService } from './audit.service';

@UseGuards(ClerkAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Resolver()
export class AuditResolver {
  constructor(private readonly auditService: AuditService) {}

  @Query(() => AuditLogsResultModel, { name: 'auditLogs' })
  auditLogs(
    @Args('page', { type: () => Int, nullable: true }) page?: number,
    @Args('limit', { type: () => Int, nullable: true }) limit?: number,
  ) {
    return this.auditService.findPaginated(page, limit);
  }
}
