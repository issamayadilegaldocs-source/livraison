import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '../auth/roles.enum';
import { TaxationModel } from './taxation.model';
import { TaxationInput } from './dto/taxation.input';
import { TaxationsService } from './taxations.service';

@Resolver(() => TaxationModel)
@UseGuards(ClerkAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class TaxationsResolver {
  constructor(private readonly taxationsService: TaxationsService) {}

  @Query(() => [TaxationModel], { name: 'taxations' })
  findAll() {
    return this.taxationsService.findAll();
  }

  @Mutation(() => TaxationModel, { name: 'createTaxation' })
  create(
    @Args('taxationInput', { type: () => TaxationInput }) taxationInput: TaxationInput,
  ) {
    return this.taxationsService.create(taxationInput);
  }

  @Mutation(() => TaxationModel, { name: 'editTaxation' })
  edit(
    @Args('taxationInput', { type: () => TaxationInput }) taxationInput: TaxationInput,
  ) {
    return this.taxationsService.edit(taxationInput);
  }
}
