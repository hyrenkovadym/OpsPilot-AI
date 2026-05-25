import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      throw new ServiceUnavailableException({
        status: 'not_ready',
        database: 'down',
        message: 'Database connection check failed',
      });
    }

    return {
      status: 'ready',
      database: 'up',
      redisConfigured: Boolean(this.configService.get<string>('redis.url')),
      timestamp: new Date().toISOString(),
    };
  }
}
