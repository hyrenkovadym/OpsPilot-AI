import { BullModule } from '@nestjs/bullmq';
import { DynamicModule, Global, Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { AsyncJobQueueClient } from './async-job-queue.client';
import { JOB_QUEUE_CLIENT } from './job-queue-client.interface';
import { JobStatusService } from './job-status.service';
import { JobsController } from './jobs.controller';
import { JobsService } from './jobs.service';
import { QUEUE_NAMES } from './queues';
import { SyncJobQueueClient } from './sync-job-queue.client';

function isAsyncQueueMode(): boolean {
  const mode = (process.env.QUEUE_MODE ?? 'async').toLowerCase();
  return mode === 'async';
}

@Global()
@Module({})
export class JobsModule {
  static register(): DynamicModule {
    const asyncMode = isAsyncQueueMode();
    const redisUrl =
      process.env.BULLMQ_REDIS_URL ??
      process.env.REDIS_URL ??
      'redis://localhost:6379';

    const queueClientProvider = asyncMode
      ? {
          provide: JOB_QUEUE_CLIENT,
          useClass: AsyncJobQueueClient,
        }
      : {
          provide: JOB_QUEUE_CLIENT,
          useClass: SyncJobQueueClient,
        };

    return {
      module: JobsModule,
      imports: [
        AuditModule,
        ...(asyncMode
          ? [
              BullModule.forRoot({
                connection: {
                  url: redisUrl,
                },
              }),
              BullModule.registerQueue(
                {
                  name: QUEUE_NAMES.ticketAi,
                },
                {
                  name: QUEUE_NAMES.knowledgeBase,
                },
              ),
            ]
          : []),
      ],
      controllers: [JobsController],
      providers: [queueClientProvider, JobsService, JobStatusService],
      exports: [JobsService, JobStatusService, JOB_QUEUE_CLIENT],
    };
  }
}
