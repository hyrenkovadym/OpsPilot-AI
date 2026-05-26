import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { WorkersAppModule } from './workers/workers-app.module';

async function bootstrapWorker(): Promise<void> {
  const app = await NestFactory.createApplicationContext(WorkersAppModule, {
    logger: ['error', 'warn', 'log'],
  });
  const logger = new Logger('WorkerBootstrap');
  const configService = app.get(ConfigService);

  const queueMode = configService.get<string>('queue.mode') ?? 'async';
  const redisUrl =
    configService.get<string>('queue.bullmq.redisUrl') ??
    configService.get<string>('redis.url') ??
    'redis://localhost:6379';

  logger.log(
    `OpsPilot worker started (QUEUE_MODE=${queueMode}, redis=${redisUrl})`,
  );
}

void bootstrapWorker();
