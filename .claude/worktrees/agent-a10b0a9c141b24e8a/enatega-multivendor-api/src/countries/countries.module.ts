import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Country, CountrySchema } from './country.schema';
import { CountriesService } from './countries.service';
import { CountriesResolver } from './countries.resolver';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Country.name, schema: CountrySchema }]),
  ],
  providers: [CountriesService, CountriesResolver],
  exports: [CountriesService],
})
export class CountriesModule {}
