import { UseGuards } from '@nestjs/common';
import { Args, Mutation, Resolver } from '@nestjs/graphql';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtUser } from '../auth/roles.enum';
import { ActivityService } from './activity.service';

@Resolver()
export class ActivityResolver {
  constructor(private readonly activityService: ActivityService) {}

  @UseGuards(ClerkAuthGuard)
  @Mutation(() => String, { name: 'createActivity', nullable: true })
  createActivity(
    @CurrentUser() jwt: JwtUser,
    @Args('groupId', { type: () => String }) groupId: string,
    @Args('module', { type: () => String }) module: string,
    @Args('screenPath', { type: () => String }) screenPath: string,
    @Args('type', { type: () => String }) type: string,
    @Args('details', { type: () => String }) details: string,
  ) {
    return this.activityService.create(jwt.userId, groupId, module, screenPath, type, details);
  }
}
