import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Country, CountryDocument } from './country.schema';

@Injectable()
export class CountriesService {
  constructor(
    @InjectModel(Country.name)
    private readonly countryModel: Model<CountryDocument>,
  ) {}

  findAll() {
    return this.countryModel.find().lean().exec();
  }

  async findByIso(iso: string) {
    const doc = await this.countryModel.findOne({ iso: iso.toUpperCase() }).lean().exec();
    if (!doc) return null;
    return { id: String((doc as any)._id), name: doc.name, cities: doc.cities ?? [] };
  }

  async findById(id: string) {
    const doc = await this.countryModel.findById(id).lean().exec();
    if (!doc) throw new NotFoundException(`Country ${id} not found`);
    return { id: String((doc as any)._id), name: doc.name, cities: doc.cities ?? [] };
  }
}
