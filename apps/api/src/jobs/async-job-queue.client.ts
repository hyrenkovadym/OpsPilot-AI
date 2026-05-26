import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import { JOB_NAMES } from './job-names';
import type {
  EnqueueOptions,
  JobQueueClient,
} from './job-queue-client.interface';
import type {
  AnalyzeTicketJobPayload,
  RechunkArticleJobPayload,
} from './job-payloads';
import { QUEUE_NAMES } from './queues';

@Injectable()
export class AsyncJobQueueClient implements JobQueueClient {
  constructor(
    @InjectQueue(QUEUE_NAMES.ticketAi)
    private readonly ticketAiQueue: Queue<AnalyzeTicketJobPayload>,
    @InjectQueue(QUEUE_NAMES.knowledgeBase)
    private readonly knowledgeBaseQueue: Queue<RechunkArticleJobPayload>,
  ) {}

  async enqueueAnalyzeTicket(
    payload: AnalyzeTicketJobPayload,
    options: EnqueueOptions,
  ): Promise<void> {
    await this.ticketAiQueue.add(JOB_NAMES.analyzeTicket, payload, {
      jobId: options.jobId,
      attempts: options.attempts,
      backoff: {
        type: 'fixed',
        delay: options.backoffMs,
      },
      removeOnComplete: 200,
      removeOnFail: 500,
    });
  }

  async enqueueRechunkArticle(
    payload: RechunkArticleJobPayload,
    options: EnqueueOptions,
  ): Promise<void> {
    await this.knowledgeBaseQueue.add(JOB_NAMES.rechunkArticle, payload, {
      jobId: options.jobId,
      attempts: options.attempts,
      backoff: {
        type: 'fixed',
        delay: options.backoffMs,
      },
      removeOnComplete: 200,
      removeOnFail: 500,
    });
  }
}
