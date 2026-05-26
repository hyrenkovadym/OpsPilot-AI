import { Injectable } from '@nestjs/common';
import type {
  EnqueueOptions,
  JobQueueClient,
} from './job-queue-client.interface';
import type {
  AnalyzeTicketJobPayload,
  RechunkArticleJobPayload,
} from './job-payloads';

@Injectable()
export class SyncJobQueueClient implements JobQueueClient {
  async enqueueAnalyzeTicket(
    payload: AnalyzeTicketJobPayload,
    options: EnqueueOptions,
  ): Promise<void> {
    void payload;
    void options;
    return Promise.resolve();
  }

  async enqueueRechunkArticle(
    payload: RechunkArticleJobPayload,
    options: EnqueueOptions,
  ): Promise<void> {
    void payload;
    void options;
    return Promise.resolve();
  }
}
