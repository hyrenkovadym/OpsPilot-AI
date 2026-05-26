import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { JOB_NAMES } from '../jobs/job-names';
import type { RechunkArticleJobPayload } from '../jobs/job-payloads';
import { JobsService } from '../jobs/jobs.service';
import { QUEUE_NAMES } from '../jobs/queues';
import { KnowledgeBaseService } from '../knowledge-base/knowledge-base.service';

@Injectable()
@Processor(QUEUE_NAMES.knowledgeBase)
export class KnowledgeBaseProcessor extends WorkerHost {
  private readonly logger = new Logger(KnowledgeBaseProcessor.name);

  constructor(
    private readonly jobsService: JobsService,
    private readonly knowledgeBaseService: KnowledgeBaseService,
  ) {
    super();
  }

  async process(job: Job<RechunkArticleJobPayload>): Promise<void> {
    if (job.name !== JOB_NAMES.rechunkArticle) {
      return;
    }

    const payload = job.data;
    const attempts = job.attemptsMade + 1;
    const startedAt = Date.now();

    await this.jobsService.markProcessing({
      jobId: payload.backgroundJobId,
      attempts,
    });

    this.logger.log(
      `Processing knowledge rechunk job=${payload.backgroundJobId} articleId=${payload.articleId}`,
    );

    try {
      await this.knowledgeBaseService.rechunkArticleForJob({
        articleId: payload.articleId,
        actorId: payload.actorId,
        backgroundJobId: payload.backgroundJobId,
        queueName: QUEUE_NAMES.knowledgeBase,
        jobName: JOB_NAMES.rechunkArticle,
      });

      await this.jobsService.markCompleted({
        jobId: payload.backgroundJobId,
        attempts,
        metadata: {
          durationMs: Date.now() - startedAt,
          queueName: QUEUE_NAMES.knowledgeBase,
          jobName: JOB_NAMES.rechunkArticle,
        },
      });
    } catch (error) {
      await this.jobsService.markFailed({
        jobId: payload.backgroundJobId,
        attempts,
        reason:
          error instanceof Error
            ? error.message
            : 'Knowledge base rechunk worker failed',
      });
      throw error;
    }
  }
}
