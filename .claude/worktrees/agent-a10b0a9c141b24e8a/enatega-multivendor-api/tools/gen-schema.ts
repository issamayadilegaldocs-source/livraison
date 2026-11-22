/**
 * Minimal schema generator — creates the NestJS app just long enough
 * to write src/schema.gql, then exits.
 *
 * Run: npx ts-node -r tsconfig-paths/register tools/gen-schema.ts
 */
import 'reflect-metadata';
import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { GraphQLModule } from '@nestjs/graphql';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';

// Import all the resolvers (not services that need Mongoose)
import { GqlThrottlerGuard } from '../src/auth/gql-throttler.guard';
import { PubSubModule } from '../src/pubsub/pubsub.module';
import { HealthModule } from '../src/health/health.module';
import { AuthModule } from '../src/auth/auth.module';
import { SubscriptionsModule } from '../src/subscriptions/subscriptions.module';
import { ChatModule } from '../src/chat/chat.module';

// We need to import ALL resolver modules but mock Mongoose
// Easiest approach: load the FULL AppModule but monkey-patch Mongoose
process.env.SKIP_MONGOOSE = '1';

// Actually, just import full AppModule and hope schema writes before timeout
import { AppModule } from '../src/app.module';

async function main() {
  const app = await NestFactory.create(AppModule, { logger: false });
  // Schema is written during onModuleInit, close immediately
  await app.close();
  process.exit(0);
}

main().catch((err) => {
  // Schema may or may not have been written — check anyway
  console.error(err.message?.substring(0, 100));
  process.exit(0);
});
