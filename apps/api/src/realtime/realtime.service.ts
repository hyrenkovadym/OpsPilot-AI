import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import {
  logStructured,
  safeErrorMessage,
} from '../common/logging/structured-log.util';
import {
  REALTIME_CHANNEL,
  type RealtimeEventEnvelope,
  type RealtimeEventName,
  type RealtimeEmitOptions,
} from './realtime-events';

interface RealtimeGatewayEmitter {
  emitEnvelope: (envelope: RealtimeEventEnvelope) => void;
}

@Injectable()
export class RealtimeService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RealtimeService.name);
  private readonly instanceId = `${process.pid}-${Math.random().toString(36).slice(2, 10)}`;
  private publisher: Redis | null = null;
  private subscriber: Redis | null = null;
  private gatewayEmitter: RealtimeGatewayEmitter | null = null;

  constructor(private readonly configService: ConfigService) {}

  isEnabled(): boolean {
    return this.configService.get<boolean>('realtime.enabled') ?? true;
  }

  async onModuleInit(): Promise<void> {
    if (!this.isEnabled()) {
      this.logger.log('Realtime is disabled by configuration.');
      return;
    }

    const redisUrl = this.getRedisUrl();

    try {
      this.publisher = new Redis(redisUrl, {
        maxRetriesPerRequest: null,
      });

      this.subscriber = new Redis(redisUrl, {
        maxRetriesPerRequest: null,
      });

      this.subscriber.on('message', (channel, message) => {
        if (channel !== REALTIME_CHANNEL) {
          return;
        }

        const envelope = this.parseEnvelope(message);
        if (!envelope) {
          return;
        }

        if (envelope.sourceInstanceId === this.instanceId) {
          return;
        }

        this.emitToGateway(envelope);
      });

      await this.subscriber.subscribe(REALTIME_CHANNEL);
      this.logger.log(`Realtime pub/sub ready on channel ${REALTIME_CHANNEL}`);
    } catch (error) {
      this.logger.error(
        `Failed to initialize realtime pub/sub bridge: ${this.safeErrorMessage(error)}`,
      );
      await this.closeRedisClients();
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.closeRedisClients();
  }

  registerGatewayEmitter(emitter: RealtimeGatewayEmitter): void {
    this.gatewayEmitter = emitter;
  }

  async publish(
    event: RealtimeEventName,
    payload: Record<string, unknown>,
    options: RealtimeEmitOptions = {},
  ): Promise<void> {
    if (!this.isEnabled()) {
      return;
    }

    const envelope: RealtimeEventEnvelope = {
      event,
      payload,
      options,
      sourceInstanceId: this.instanceId,
      timestamp: new Date().toISOString(),
    };

    if (!this.publisher) {
      this.emitToGateway(envelope);
      return;
    }

    try {
      await this.publisher.publish(REALTIME_CHANNEL, JSON.stringify(envelope));
      this.emitToGateway(envelope);
      logStructured('info', 'realtime.event.published', {
        event,
        rooms: options.rooms ?? [],
        broadcast: options.broadcast ?? false,
      });
    } catch (error) {
      this.logger.error(
        `Failed to publish realtime event ${event}: ${this.safeErrorMessage(error)}`,
      );
      this.emitToGateway(envelope);
    }
  }

  private emitToGateway(envelope: RealtimeEventEnvelope): void {
    this.gatewayEmitter?.emitEnvelope(envelope);
  }

  private parseEnvelope(rawMessage: string): RealtimeEventEnvelope | null {
    try {
      const parsed = JSON.parse(rawMessage) as Partial<RealtimeEventEnvelope>;
      if (
        !parsed ||
        typeof parsed.event !== 'string' ||
        typeof parsed.timestamp !== 'string' ||
        typeof parsed.sourceInstanceId !== 'string' ||
        typeof parsed.payload !== 'object' ||
        parsed.payload === null
      ) {
        return null;
      }

      return {
        event: parsed.event,
        payload: parsed.payload,
        options:
          typeof parsed.options === 'object' && parsed.options !== null
            ? parsed.options
            : {},
        sourceInstanceId: parsed.sourceInstanceId,
        timestamp: parsed.timestamp,
      };
    } catch {
      return null;
    }
  }

  private getRedisUrl(): string {
    return (
      this.configService.get<string>('queue.bullmq.redisUrl') ??
      this.configService.get<string>('redis.url') ??
      'redis://localhost:6379'
    );
  }

  private safeErrorMessage(error: unknown): string {
    return safeErrorMessage(error, 'Unknown realtime error');
  }

  private async closeRedisClients(): Promise<void> {
    if (this.subscriber) {
      await this.subscriber.quit().catch(() => {
        this.subscriber?.disconnect();
      });
      this.subscriber = null;
    }

    if (this.publisher) {
      await this.publisher.quit().catch(() => {
        this.publisher?.disconnect();
      });
      this.publisher = null;
    }
  }
}
