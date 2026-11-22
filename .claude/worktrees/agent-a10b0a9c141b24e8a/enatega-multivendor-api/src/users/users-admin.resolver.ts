import { UseGuards } from '@nestjs/common';
import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { Role, JwtUser } from '../auth/roles.enum';
import { AuditService } from '../audit/audit.service';
import { UserModel } from './models/user.model';
import { UsersService } from './users.service';

@UseGuards(ClerkAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Resolver(() => UserModel)
export class UsersAdminResolver {
  constructor(
    private readonly usersService: UsersService,
    private readonly auditService: AuditService,
  ) {}

  @Query(() => [UserModel], { name: 'users' })
  users() {
    return this.usersService.findAll();
  }

  @Query(() => UserModel, { name: 'user' })
  user(@Args('id', { type: () => ID }) id: string) {
    return this.usersService.findById(id);
  }

  @Mutation(() => UserModel, { name: 'updateUserStatus' })
  async updateUserStatus(
    @CurrentUser() jwt: JwtUser,
    @Args('id', { type: () => ID }) id: string,
    @Args('status', { type: () => String }) status: string,
    @Args('reason', { type: () => String, nullable: true }) reason?: string,
  ) {
    const result = await this.usersService.updateStatus(id, status, reason);
    this.auditService.create(jwt.userId, jwt.userId, 'UPDATE_USER_STATUS', 'User', id, status).catch(() => undefined);
    return result;
  }

  @Mutation(() => UserModel, { name: 'updateUserNotes' })
  updateUserNotes(
    @Args('id', { type: () => ID }) id: string,
    @Args('notes', { type: () => String }) notes: string,
  ) {
    return this.usersService.updateNotes(id, notes);
  }

  @Mutation(() => UserModel, { name: 'deleteUser' })
  async deleteUser(
    @CurrentUser() jwt: JwtUser,
    @Args('id', { type: () => ID }) id: string,
  ) {
    const result = await this.usersService.deleteOne(id);
    this.auditService.create(jwt.userId, jwt.userId, 'DELETE_USER', 'User', id).catch(() => undefined);
    return result;
  }

  @Mutation(() => UserModel, { name: 'resetUserSession' })
  resetUserSession(@Args('userId', { type: () => ID }) userId: string) {
    return this.usersService.resetSession(userId);
  }
}
