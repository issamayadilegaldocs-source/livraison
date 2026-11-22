import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '../auth/roles.enum';
import { TippingModel } from './tipping.model';
import { TippingInput } from './dto/tipping.input';
import { TippingsService } from './tippings.service';

@Resolver(() => TippingModel)
export class TippingsResolver {
  constructor(private readonly tippingsService: TippingsService) {}

  // Public read: tip presets are harmless display config consumed by the
  // customer app cart/checkout (guest included) and the web checkout. Every
  // frontend reads `tips` as a single object, not a list.
  @Query(() => TippingModel, { name: 'tips', nullable: true })
  findFirst() {
    return this.tippingsService.findFirst();
  }

  @UseGuards(ClerkAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Mutation(() => TippingModel, { name: 'createTipping' })
  create(
    @Args('tippingInput', { type: () => TippingInput }) tippingInput: TippingInput,
  ) {
    return this.tippingsService.create(tippingInput);
  }

  @UseGuards(ClerkAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Mutation(() => TippingModel, { name: 'editTipping' })
  edit(
    @Args('tippingInput', { type: () => TippingInput }) tippingInput: TippingInput,
  ) {
    return this.tippingsService.edit(tippingInput);
  }
}
