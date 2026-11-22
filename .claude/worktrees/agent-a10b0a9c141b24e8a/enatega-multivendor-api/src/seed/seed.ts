import { Logger, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { MongooseModule, getModelToken } from '@nestjs/mongoose';
import { hashPassword } from '../common/crypto.util';
import { Model } from 'mongoose';
import {
  Configuration,
  ConfigurationDocument,
  ConfigurationSchema,
} from '../configuration/configuration.schema';
import { Owner, OwnerDocument, OwnerSchema } from '../owners/owner.schema';
import {
  Restaurant,
  RestaurantDocument,
  RestaurantSchema,
} from '../restaurants/restaurant.schema';
import { Rider, RiderDocument, RiderSchema } from '../riders/rider.schema';

/**
 * Minimal module for the seed script: just config + a Mongo connection and the
 * four schemas it writes. It deliberately omits GraphQL/HTTP so the script runs
 * as a plain application context.
 */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        uri: config.get<string>(
          'MONGO_URI',
          'mongodb://127.0.0.1:27017/enatega',
        ),
      }),
    }),
    MongooseModule.forFeature([
      { name: Configuration.name, schema: ConfigurationSchema },
      { name: Owner.name, schema: OwnerSchema },
      { name: Restaurant.name, schema: RestaurantSchema },
      { name: Rider.name, schema: RiderSchema },
    ]),
  ],
})
class SeedModule {}


/**
 * Idempotently seeds the development data needed to exercise the auth and
 * configuration flows: a single configuration document plus one account for
 * each login (super-admin, vendor + its restaurant/store, and a rider).
 *
 * Re-running is safe: existing records are left untouched (passwords are never
 * re-hashed). Credentials are read from `SEED_*` env vars with dev defaults.
 */
async function seed(): Promise<void> {
  const logger = new Logger('Seed');
  const app = await NestFactory.createApplicationContext(SeedModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    const config = app.get(ConfigService);
    const env = (key: string, fallback: string): string =>
      config.get<string>(key, fallback);

    const configurationModel = app.get<Model<ConfigurationDocument>>(
      getModelToken(Configuration.name),
    );
    const ownerModel = app.get<Model<OwnerDocument>>(
      getModelToken(Owner.name),
    );
    const restaurantModel = app.get<Model<RestaurantDocument>>(
      getModelToken(Restaurant.name),
    );
    const riderModel = app.get<Model<RiderDocument>>(
      getModelToken(Rider.name),
    );

    // --- Configuration: ensure the single document exists with defaults. ---
    const configuration = await configurationModel.findOneAndUpdate(
      {},
      { $setOnInsert: { currency: 'USD', currencySymbol: '$', maxTipPercentage: 25, riderCommissionRate: 0.8 } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    logger.log(`Configuration ready (_id=${configuration._id.toString()}).`);

    // --- Super-admin owner (ownerLogin -> ADMIN). ---
    const adminEmail = env('SEED_ADMIN_EMAIL', 'admin@enatega.com').toLowerCase();
    const adminPassword = env('SEED_ADMIN_PASSWORD', 'password123');
    await ensureOwner(ownerModel, logger, {
      email: adminEmail,
      password: adminPassword,
      userType: 'ADMIN',
      name: 'Super Admin',
    });

    // --- Vendor owner + its restaurant/store (ownerLogin -> VENDOR). ---
    const vendorEmail = env('SEED_VENDOR_EMAIL', 'vendor@enatega.com').toLowerCase();
    const vendorPassword = env('SEED_VENDOR_PASSWORD', 'password123');
    const vendor = await ensureOwner(ownerModel, logger, {
      email: vendorEmail,
      password: vendorPassword,
      userType: 'VENDOR',
      name: 'Demo Vendor',
    });

    const restaurantUsername = env('SEED_RESTAURANT_USERNAME', 'restaurant');
    const restaurantPassword = env('SEED_RESTAURANT_PASSWORD', 'password123');
    const restaurant = await ensureRestaurant(restaurantModel, logger, {
      username: restaurantUsername,
      password: restaurantPassword,
      name: 'Demo Restaurant',
      address: '123 Demo Street',
      ownerId: vendor._id,
    });

    // Link the restaurant to its vendor so ownerLogin returns it.
    if (!(vendor.restaurants ?? []).some((id) => id.equals(restaurant._id))) {
      vendor.restaurants = [...(vendor.restaurants ?? []), restaurant._id];
      await vendor.save();
      logger.log(`Linked restaurant "${restaurantUsername}" to ${vendorEmail}.`);
    }

    // --- Rider (riderLogin -> RIDER). ---
    const riderUsername = env('SEED_RIDER_USERNAME', 'rider');
    const riderPassword = env('SEED_RIDER_PASSWORD', 'password123');
    await ensureRider(riderModel, logger, {
      username: riderUsername,
      password: riderPassword,
      name: 'Demo Rider',
    });

    logger.log('Seed complete.');
    logger.warn(
      'Seeded accounts use development credentials — override the SEED_* env vars (or change the passwords) before any non-local use.',
    );
  } finally {
    await app.close();
  }
}

async function ensureOwner(
  model: Model<OwnerDocument>,
  logger: Logger,
  data: { email: string; password: string; userType: string; name: string },
): Promise<OwnerDocument> {
  const hashed = await hashPassword(data.password);
  const doc = await model.findOneAndUpdate(
    { email: data.email },
    { $setOnInsert: { email: data.email, password: hashed, userType: data.userType, name: data.name, permissions: [], isActive: true } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  ).exec();
  logger.log(`Owner ${data.email} ready (${data.userType}).`);
  return doc as OwnerDocument;
}

async function ensureRestaurant(
  model: Model<RestaurantDocument>,
  logger: Logger,
  data: {
    username: string;
    password: string;
    name: string;
    address: string;
    ownerId: OwnerDocument['_id'];
  },
): Promise<RestaurantDocument> {
  const hashed = await hashPassword(data.password);
  const doc = await model.findOneAndUpdate(
    { username: data.username },
    { $setOnInsert: { username: data.username, password: hashed, name: data.name, address: data.address, owner: data.ownerId, isActive: true } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  ).exec();
  logger.log(`Restaurant "${data.username}" ready.`);
  return doc as RestaurantDocument;
}

async function ensureRider(
  model: Model<RiderDocument>,
  logger: Logger,
  data: { username: string; password: string; name: string },
): Promise<RiderDocument> {
  const hashed = await hashPassword(data.password);
  const doc = await model.findOneAndUpdate(
    { username: data.username },
    { $setOnInsert: { username: data.username, password: hashed, name: data.name, available: false, isActive: true } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  ).exec();
  logger.log(`Rider "${data.username}" ready.`);
  return doc as RiderDocument;
}

seed().catch((error) => {
  new Logger('Seed').error(error);
  process.exit(1);
});
