import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '../auth/roles.enum';
import { OwnerModel } from './owner.model';
import { InviteVendorInput, VendorInput } from './dto/vendor.input';
import { OwnersService } from './owners.service';

@Resolver(() => OwnerModel)
@UseGuards(ClerkAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class OwnersAdminResolver {
  constructor(private readonly ownersService: OwnersService) {}

  @Query(() => [OwnerModel], { name: 'vendors' })
  vendors() {
    return this.ownersService.findAll();
  }

  @Query(() => OwnerModel, { name: 'getVendor', nullable: true })
  getVendor(@Args('id', { type: () => String }) id: string) {
    return this.ownersService.findById(id);
  }

  @Mutation(() => OwnerModel, { name: 'createVendor', nullable: true })
  createVendor(
    @Args('vendorInput', { type: () => VendorInput, nullable: true }) vendorInput: VendorInput,
  ) {
    return this.ownersService.createVendor(vendorInput);
  }

  @Mutation(() => OwnerModel, { name: 'editVendor', nullable: true })
  editVendor(
    @Args('vendorInput', { type: () => VendorInput, nullable: true }) vendorInput: VendorInput,
  ) {
    return this.ownersService.editVendor(vendorInput);
  }

  @Mutation(() => Boolean, { name: 'deleteVendor' })
  deleteVendor(@Args('id', { type: () => String }) id: string) {
    return this.ownersService.deleteVendor(id);
  }

  @Mutation(() => OwnerModel, { name: 'inviteVendor' })
  inviteVendor(
    @Args('input', { type: () => InviteVendorInput }) input: InviteVendorInput,
  ) {
    return this.ownersService.inviteVendor(input);
  }

  @Mutation(() => OwnerModel, { name: 'resendVendorInvitation' })
  resendVendorInvitation(@Args('id', { type: () => String }) id: string) {
    return this.ownersService.resendVendorInvitation(id);
  }

  @Mutation(() => OwnerModel, { name: 'revokeVendorInvitation' })
  revokeVendorInvitation(@Args('id', { type: () => String }) id: string) {
    return this.ownersService.revokeVendorInvitation(id);
  }
}
