import { Logger, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { MongooseModule, getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  Restaurant,
  RestaurantDocument,
  RestaurantSchema,
} from '../restaurants/restaurant.schema';
import { GoogleTimezoneProvider } from '../providers/google-timezone.provider';

/**
 * One-off backfill: fills `timezone` for existing restaurants from their stored
 * coordinates via the Google Time Zone API. Idempotent — restaurants that
 * already have a timezone, or have no usable location, are skipped. Requires
 * GOOGLE_MAPS_API_KEY (or a Routes key with the Time Zone API enabled).
 *
 * Run: ts-node -r tsconfig-paths/register src/scripts/backfill-restaurant-timezone.ts
 */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        uri: config.get<string>('MONGO_URI', 'mongodb://127.0.0.1:27017/enatega'),
      }),
    }),
    MongooseModule.forFeature([{ name: Restaurant.name, schema: RestaurantSchema }]),
  ],
  providers: [GoogleTimezoneProvider],
})
class BackfillModule {}

async function backfill(): Promise<void> {
  const logger = new Logger('BackfillTimezone');
  const app = await NestFactory.createApplicationContext(BackfillModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    const restaurantModel = app.get<Model<RestaurantDocument>>(getModelToken(Restaurant.name));
    const provider = app.get(GoogleTimezoneProvider);

    const restaurants = await restaurantModel
      .find(
        {
          $or: [{ timezone: { $exists: false } }, { timezone: null }, { timezone: '' }],
          'location.coordinates.0': { $exists: true },
        },
        '_id name location timezone',
      )
      .lean()
      .exec();

    logger.log(`Found ${restaurants.length} restaurant(s) without a timezone`);
    let updated = 0;
    let skipped = 0;

    for (const r of restaurants as any[]) {
      const coords = r.location?.coordinates;
      if (!Array.isArray(coords) || coords.length < 2) {
        skipped++;
        continue;
      }
      const [lng, lat] = coords;
      const timezone = await provider.timezoneFor([lng, lat]);
      if (!timezone) {
        logger.warn(`No timezone resolved for ${r.name ?? r._id}; leaving unset`);
        skipped++;
        continue;
      }
      await restaurantModel.updateOne({ _id: r._id }, { $set: { timezone } }).exec();
      logger.log(`${r.name ?? r._id} → ${timezone}`);
      updated++;
    }

    logger.log(`Backfill complete: ${updated} updated, ${skipped} skipped`);
  } finally {
    await app.close();
  }
}

backfill()
  .then(() => process.exit(0))
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error('Backfill failed:', err);
    process.exit(1);
  });
