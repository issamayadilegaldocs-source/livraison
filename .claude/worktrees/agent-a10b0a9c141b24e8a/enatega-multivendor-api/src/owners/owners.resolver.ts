import { NotFoundException, UseGuards } from '@nestjs/common';
import { Query, Resolver } from '@nestjs/graphql';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { Role, JwtUser } from '../auth/roles.enum';
import { OwnerProfile } from './owner.model';
import { OwnersService } from './owners.service';

@Resolver()
export class OwnersResolver {
  constructor(private readonly ownersService: OwnersService) {}

  @Query(() => OwnerProfile)
  @UseGuards(ClerkAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.VENDOR, Role.STORE)
  async ownerProfile(@CurrentUser() user: JwtUser): Promise<OwnerProfile> {
    const owner = await this.ownersService.findByClerkId(user.userId);
    if (!owner) throw new NotFoundException('Owner profile not found');
    return owner as unknown as OwnerProfile;
  }
}
