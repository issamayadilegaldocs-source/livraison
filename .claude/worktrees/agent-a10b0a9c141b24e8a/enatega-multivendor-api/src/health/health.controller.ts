import { Controller, Get, HttpStatus, Inject, Res } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import Redis from 'ioredis';
import type { Response } from 'express';
import { apiConfig } from '../common/api.config';
import { REDIS_CLIENT } from '../pubsub/pubsub.module';

@Controller('health')
export class HealthController {
  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    @InjectConnection() private readonly mongoConnection: Connection,
  ) {}

  /** Liveness: is the process itself able to respond? Deliberately does not
   * check external dependencies — flipping this on a Mongo/Redis blip would
   * make Docker/Dokploy restart a perfectly healthy process in a loop
   * without fixing the actual outage. Wired to the Dockerfile HEALTHCHECK. */
  @Get()
  getHealth() {
    return {
      status: 'ok',
      app: apiConfig.name,
      name: apiConfig.displayName,
      timestamp: new Date().toISOString(),
    };
  }

  /** Readiness: are the dependencies this process needs to serve traffic
   * actually up? Point load-balancer / rolling-deploy traffic gating at
   * this endpoint, not at liveness — a 503 here should stop new traffic
   * from being routed here, not restart the container. */
  @Get('ready')
  getReadiness(@Res() res: Response) {
    const mongoReady = this.mongoConnection.readyState === 1;
    const redisReady = this.redis.status === 'ready';
    const ready = mongoReady && redisReady;

    res.status(ready ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE).json({
      status: ready ? 'ok' : 'degraded',
      mongo: mongoReady ? 'ok' : 'down',
      tracking: redisReady ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
    });
  }
}
