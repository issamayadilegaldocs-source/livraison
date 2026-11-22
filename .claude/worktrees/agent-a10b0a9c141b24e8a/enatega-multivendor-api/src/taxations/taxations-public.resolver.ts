import { Query, Resolver } from '@nestjs/graphql';
import { TaxationModel } from './taxation.model';
import { TaxationsService } from './taxations.service';

@Resolver()
export class TaxationsPublicResolver {
  constructor(private readonly taxationsService: TaxationsService) {}

  @Query(() => [TaxationModel], { name: 'taxes' })
  taxes() {
    return this.taxationsService.findAll();
  }
}
