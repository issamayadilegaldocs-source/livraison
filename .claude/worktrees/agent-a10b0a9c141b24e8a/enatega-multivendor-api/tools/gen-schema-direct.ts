/**
 * Generate schema.gql directly from NestJS resolver metadata without
 * needing a real database connection.
 *
 * Run: npx ts-node -r tsconfig-paths/register tools/gen-schema-direct.ts
 */
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { PubSubModule } from '../src/pubsub/pubsub.module';
import * as path from 'path';

// Import only the resolver providers (no Mongoose services)
// We need all ObjectType / InputType decorators to be loaded
// Loading the modules causes the DI container to be set up,
// so we need to provide mocks for services that have DB dependencies.

// Easiest: just import all *.model.ts and *.input.ts files to register their metadata
// But this requires knowing all file paths.

// Alternative: use a special bootstrapped module that overrides providers.
// The simplest approach: import AppModule but replace MongooseModule with a no-op.

// Monkey-patch MongooseModule before importing AppModule
const MongooseModule = require('@nestjs/mongoose').MongooseModule;
const originalForRootAsync = MongooseModule.forRootAsync.bind(MongooseModule);
MongooseModule.forRootAsync = function(options: any) {
  return {
    module: class NoOpMongoose {},
    providers: [],
    exports: [],
    global: true,
  } as any;
};
const originalForRoot = MongooseModule.forRoot.bind(MongooseModule);
MongooseModule.forRoot = function(...args: any[]) {
  return {
    module: class NoOpMongoose2 {},
    providers: [],
    exports: [],
    global: true,
  } as any;
};
const originalForFeature = MongooseModule.forFeature.bind(MongooseModule);
MongooseModule.forFeature = function(models: any[], connectionName?: any) {
  return {
    module: class NoOpMongooseFeature {},
    providers: models.map((m: any) => ({
      provide: `${m.name}Model`,
      useValue: {},
    })),
    exports: models.map((m: any) => `${m.name}Model`),
  } as any;
};

async function main() {
  const { AppModule } = await import('../src/app.module');
  const app = await NestFactory.create(AppModule, { logger: false });
  await app.init();
  await app.close();
  console.log('Schema generated successfully');
  process.exit(0);
}

main().catch((err) => {
  console.error('Error:', err?.message?.slice(0, 300));
  process.exit(0);
});
