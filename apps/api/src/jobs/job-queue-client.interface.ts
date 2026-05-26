import type {
  AnalyzeTicketJobPayload,
  RechunkArticleJobPayload,
} from './job-payloads';

export const JOB_QUEUE_CLIENT = Symbol('JOB_QUEUE_CLIENT');

export interface EnqueueOptions {
  jobId: string;
  attempts: number;
  backoffMs: number;
}

export interface JobQueueClient {
  enqueueAnalyzeTicket(
    payload: AnalyzeTicketJobPayload,
    options: EnqueueOptions,
  ): Promise<void>;
  enqueueRechunkArticle(
    payload: RechunkArticleJobPayload,
    options: EnqueueOptions,
  ): Promise<void>;
}
