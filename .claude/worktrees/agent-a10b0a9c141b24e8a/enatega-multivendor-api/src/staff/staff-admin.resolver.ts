import { UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { Role, JwtUser } from '../auth/roles.enum';
import { AuditService } from '../audit/audit.service';
import { StaffModel } from './staff.model';
import { StaffInput } from './dto/staff.input';
import { StaffService } from './staff.service';

@UseGuards(ClerkAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Resolver(() => StaffModel)
export class StaffAdminResolver {
  constructor(
    private readonly staffService: StaffService,
    private readonly auditService: AuditService,
  ) {}

  @Query(() => [StaffModel], { name: 'staffs' })
  staffs() {
    return this.staffService.findAll();
  }

  @Mutation(() => StaffModel, { name: 'createStaff' })
  createStaff(
    @Args('staffInput', { type: () => StaffInput }) input: StaffInput,
  ) {
    return this.staffService.create(input);
  }

  @Mutation(() => StaffModel, { name: 'editStaff' })
  async editStaff(
    @CurrentUser() jwt: JwtUser,
    @Args('staffInput', { type: () => StaffInput }) input: StaffInput,
  ) {
    const result = await this.staffService.edit(input);
    this.auditService.create(jwt.userId, jwt.userId, 'EDIT_STAFF', 'Staff', input._id ?? '').catch(() => undefined);
    return result;
  }

  @Mutation(() => StaffModel, { name: 'deleteStaff' })
  async deleteStaff(
    @CurrentUser() jwt: JwtUser,
    @Args('id', { type: () => String }) id: string,
  ) {
    const result = await this.staffService.delete(id);
    this.auditService.create(jwt.userId, jwt.userId, 'DELETE_STAFF', 'Staff', id).catch(() => undefined);
    return result;
  }
}
