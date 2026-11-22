import { Args, ID, Query, Resolver } from '@nestjs/graphql';
import { CountryModel, CountryWithCitiesModel } from './country.model';
import { CountriesService } from './countries.service';

@Resolver()
export class CountriesResolver {
  constructor(private readonly countriesService: CountriesService) {}

  @Query(() => [CountryModel], { name: 'getCountries' })
  getCountries() {
    return this.countriesService.findAll();
  }

  @Query(() => CountryWithCitiesModel, { name: 'getCitiesByCountry', nullable: true })
  getCitiesByCountry(
    @Args('id', { type: () => ID, nullable: true }) id?: string,
  ) {
    if (!id) return null;
    return this.countriesService.findById(id);
  }

  @Query(() => CountryWithCitiesModel, { name: 'getCountryByIso', nullable: true })
  getCountryByIso(
    @Args('iso', { type: () => String }) iso: string,
  ) {
    return this.countriesService.findByIso(iso);
  }
}
