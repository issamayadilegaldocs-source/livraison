import { Logger, Type, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ApiConfig } from './api.config';

export async function bootstrapApi(module: Type<unknown>, config: ApiConfig): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(module, {
    rawBody: true,
    bodyParser: false,
  });
  const configService = app.get(ConfigService);
  const logger = new Logger(config.displayName);
  const prefix = configService.get<string>('GLOBAL_PREFIX', 'api');
  const bodyLimit = configService.get<string>('REQUEST_BODY_LIMIT', '15mb');
  const port = parsePort(
    configService.get<string>('PORT') ?? configService.get<string>(config.portEnv),
    config.defaultPort,
  );
  const corsOrigins = configService
    .get<string>('CORS_ORIGINS', '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      forbidUnknownValues: false,
    }),
  );
  app.useBodyParser('json', { limit: bodyLimit });
  app.useBodyParser('urlencoded', { limit: bodyLimit, extended: true });
  app.setGlobalPrefix(prefix);
  app.enableCors(corsOrigins.length ? { origin: corsOrigins } : undefined);

  if (corsOrigins.length === 0 && configService.get<string>('NODE_ENV') === 'production') {
    logger.error(
      'CORS_ORIGINS is not set in production — CORS is wide open (any origin allowed). ' +
        'Set CORS_ORIGINS to a comma-separated allowlist before real traffic relies on this deployment.',
    );
  }

  // Let onModuleDestroy/beforeApplicationShutdown hooks run on SIGTERM/SIGINT
  // so in-flight requests can finish and the Mongo/Redis connections close
  // cleanly instead of being killed mid-write during a rolling deploy.
  app.enableShutdownHooks();

  await app.listen(port, '0.0.0.0');
  logger.log(`${config.displayName} listening on http://localhost:${port}/${prefix}`);
}

function parsePort(value: string | undefined, fallback: number): number {
  if (!value) return fallback;

  const port = Number(value);
  return Number.isInteger(port) && port > 0 ? port : fallback;
}
