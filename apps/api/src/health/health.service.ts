import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class HealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  getHealth() {
    return {
      status: 'ok',
      service: 'opspilot-api',
      timestamp: new Date().toISOString(),
    };
  }

  async getReadiness() {
    const queueMode = this.configService.get<string>('queue.mode') ?? 'async';
    const realtimeEnabled =
      this.configService.get<boolean>('realtime.enabled') ?? true;
    const aiProvider = this.configService.get<string>('ai.provider') ?? 'mock';

    const databaseStatus = await this.checkDatabaseStatus();
    const redisStatus = await this.checkRedisStatus();

    if (databaseStatus !== 'up') {
      throw new ServiceUnavailableException({
        status: 'not_ready',
        database: databaseStatus,
        redis: redisStatus,
        queueMode,
        realtimeEnabled,
        aiProvider,
        message: 'Database connection check failed',
      });
    }

    if (redisStatus !== 'up' && queueMode === 'async') {
      throw new ServiceUnavailableException({
        status: 'not_ready',
        database: databaseStatus,
        redis: redisStatus,
        queueMode,
        realtimeEnabled,
        aiProvider,
        message: 'Redis connection check failed in async queue mode',
      });
    }

    return {
      status: 'ready',
      database: databaseStatus,
      redis: redisStatus,
      queueMode,
      realtimeEnabled,
      aiProvider,
      workerQueueConfigured: queueMode === 'async',
      timestamp: new Date().toISOString(),
    };
  }

  getSystemInfo() {
    return {
      service: 'opspilot-api',
      nodeEnv: this.configService.get<string>('app.env') ?? 'development',
      nodeVersion: process.version,
      platform: process.platform,
      pid: process.pid,
      uptimeSeconds: Math.floor(process.uptime()),
      queueMode: this.configService.get<string>('queue.mode') ?? 'async',
      realtimeEnabled:
        this.configService.get<boolean>('realtime.enabled') ?? true,
      aiProvider: this.configService.get<string>('ai.provider') ?? 'mock',
      timestamp: new Date().toISOString(),
    };
  }

  private async checkDatabaseStatus(): Promise<'up' | 'down'> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return 'up';
    } catch {
      return 'down';
    }
  }

  private async checkRedisStatus(): Promise<'up' | 'down' | 'not_configured'> {
    const redisUrl =
      this.configService.get<string>('queue.bullmq.redisUrl') ??
      this.configService.get<string>('redis.url');

    if (!redisUrl) {
      return 'not_configured';
    }

    const client = new Redis(redisUrl, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      connectTimeout: 1500,
    });

    try {
      await client.connect();
      const pong = await client.ping();
      return pong === 'PONG' ? 'up' : 'down';
    } catch {
      return 'down';
    } finally {
      await client.quit().catch(() => client.disconnect());
    }
  }
}
